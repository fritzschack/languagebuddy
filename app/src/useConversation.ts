import { useCallback, useEffect, useRef, useState } from "react";
import * as Speech from "expo-speech";
import { ExpoSpeechRecognitionModule, useSpeechRecognitionEvent } from "expo-speech-recognition";
import {
  analyzeLearner,
  describeError,
  hintsForLine,
  howToSay,
  partnerReply,
  type HowToSay,
  type LearnerAnalysis,
  type LineHints,
  type Turn,
} from "./claude";
import type { Settings } from "./settings";

export type Phase = "idle" | "listening" | "thinking" | "speaking";

export type Message =
  | {
      id: string;
      role: "partner";
      text: string;
      translation: string;
      hints: LineHints | "loading" | "error" | null;
    }
  | {
      id: string;
      role: "learner";
      text: string;
      analysis: LearnerAnalysis | "loading" | "error";
    }
  | { id: string; role: "help"; question: string; answer: HowToSay };

type EndIntent = "submit" | "ignore" | null;

let idCounter = 0;
const newId = () => `${Date.now()}-${idCounter++}`;

/**
 * The hands-free loop: listen in the target language → when you pause, send
 * what you said → Claude replies (and, in parallel, translates and checks
 * your line) → the reply is spoken → listening starts again.
 */
export function useConversation(settings: Settings, apiKey: string | null) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [phase, setPhaseState] = useState<Phase>("idle");
  const [liveText, setLiveText] = useState("");
  const [helpMode, setHelpModeState] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Refs mirror state so native event callbacks always see current values.
  const phaseRef = useRef<Phase>("idle");
  const activeRef = useRef(false);
  const helpRef = useRef(false);
  const transcriptRef = useRef("");
  const endIntentRef = useRef<EndIntent>(null);
  const silenceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const endFallbackTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const restartCount = useRef(0);
  const messagesRef = useRef<Message[]>([]);
  const settingsRef = useRef(settings);
  const keyRef = useRef(apiKey);
  settingsRef.current = settings;
  keyRef.current = apiKey;

  const setPhase = (p: Phase) => {
    phaseRef.current = p;
    setPhaseState(p);
  };
  const setHelpMode = (on: boolean) => {
    helpRef.current = on;
    setHelpModeState(on);
  };
  const updateMessages = (fn: (m: Message[]) => Message[]) => {
    messagesRef.current = fn(messagesRef.current);
    setMessages(messagesRef.current);
  };
  const patchMessage = (id: string, patch: Partial<Message>) =>
    updateMessages((all) => all.map((m) => (m.id === id ? ({ ...m, ...patch } as Message) : m)));

  const turns = (): Turn[] =>
    messagesRef.current.flatMap((m): Turn[] =>
      m.role === "partner" || m.role === "learner" ? [{ role: m.role, text: m.text }] : [],
    );

  const clearTimers = () => {
    if (silenceTimer.current) clearTimeout(silenceTimer.current);
    if (endFallbackTimer.current) clearTimeout(endFallbackTimer.current);
    silenceTimer.current = endFallbackTimer.current = null;
  };

  // ---------- speaking ----------

  const speak = (text: string, opts: { rate?: number; locale?: string } = {}) => {
    setPhase("speaking");
    Speech.stop();
    Speech.speak(text, {
      language: opts.locale ?? settingsRef.current.targetLocale,
      rate: opts.rate ?? settingsRef.current.speechRate,
      onDone: () => {
        if (phaseRef.current !== "speaking") return;
        if (activeRef.current) listen();
        else setPhase("idle");
      },
      onError: () => {
        if (activeRef.current) listen();
        else setPhase("idle");
      },
    });
  };

  // ---------- listening ----------

  const stopRecognition = (intent: EndIntent) => {
    endIntentRef.current = intent;
    try {
      if (intent === "submit") ExpoSpeechRecognitionModule.stop();
      else ExpoSpeechRecognitionModule.abort();
    } catch {
      // Not running; nothing to stop.
    }
  };

  const listen = () => {
    clearTimers();
    transcriptRef.current = "";
    setLiveText("");
    endIntentRef.current = null;
    setPhase("listening");
    const locale = helpRef.current ? settingsRef.current.nativeLocale : settingsRef.current.targetLocale;
    ExpoSpeechRecognitionModule.start({
      lang: locale,
      interimResults: true,
      continuous: true,
      addsPunctuation: true,
      iosCategory: {
        category: "playAndRecord",
        categoryOptions: ["defaultToSpeaker", "allowBluetooth"],
        mode: "default",
      },
    });
  };

  /** You paused: stop listening and send what was heard once the recognizer finishes. */
  const finishTurn = () => {
    if (phaseRef.current !== "listening") return;
    clearTimers();
    stopRecognition("submit");
    // If the recognizer never reports "end", send anyway.
    endFallbackTimer.current = setTimeout(() => {
      if (endIntentRef.current === "submit") submit(transcriptRef.current);
    }, 1500);
  };

  useSpeechRecognitionEvent("result", (e) => {
    if (phaseRef.current !== "listening") return;
    const text = e.results[0]?.transcript ?? "";
    transcriptRef.current = text;
    setLiveText(text);
    restartCount.current = 0;
    if (silenceTimer.current) clearTimeout(silenceTimer.current);
    if (text.trim() && endIntentRef.current === null) {
      silenceTimer.current = setTimeout(finishTurn, settingsRef.current.silenceMs);
    }
  });

  useSpeechRecognitionEvent("end", () => {
    const intent = endIntentRef.current;
    endIntentRef.current = null;
    if (intent === "submit") {
      submit(transcriptRef.current);
      return;
    }
    if (intent === "ignore") return;
    // The recognizer stopped by itself (time limit, silence, interruption).
    if (!activeRef.current || phaseRef.current !== "listening") return;
    if (transcriptRef.current.trim()) {
      submit(transcriptRef.current);
    } else if (restartCount.current++ < 5) {
      listen();
    } else {
      pause();
      setError("Listening stopped. Tap the button to continue.");
    }
  });

  useSpeechRecognitionEvent("error", (e) => {
    if (e.error === "aborted" || e.error === "no-speech") return; // "end" follows and handles it
    if (e.error === "not-allowed" || e.error === "service-not-allowed") {
      pause();
      setError("Microphone or speech recognition access is off. Turn it on in the Settings app under Language Buddy.");
    } else if (e.error === "language-not-supported") {
      pause();
      setError("Speech recognition doesn't support this language on your phone. Pick another variant in Settings.");
    } else if (e.error === "network") {
      setError("Speech recognition needs a connection. Check your network.");
    }
  });

  // ---------- turns ----------

  const fail = (e: unknown) => {
    activeRef.current = false;
    setPhase("idle");
    setError(describeError(e));
  };

  const partnerMove = async () => {
    setPhase("thinking");
    try {
      const r = await partnerReply(keyRef.current, settingsRef.current, turns());
      if (!activeRef.current) return;
      updateMessages((all) => [
        ...all,
        { id: newId(), role: "partner", text: r.reply, translation: r.translation, hints: null },
      ]);
      speak(r.reply);
    } catch (e) {
      fail(e);
    }
  };

  const submit = async (raw: string) => {
    clearTimers();
    endIntentRef.current = null;
    const text = raw.trim();
    setLiveText("");
    if (!activeRef.current) return;
    if (!text) {
      listen();
      return;
    }

    if (helpRef.current) {
      setHelpMode(false);
      setPhase("thinking");
      try {
        const answer = await howToSay(keyRef.current, settingsRef.current, turns(), text);
        if (!activeRef.current) return;
        updateMessages((all) => [...all, { id: newId(), role: "help", question: text, answer }]);
        speak(answer.target);
      } catch (e) {
        fail(e);
      }
      return;
    }

    const id = newId();
    updateMessages((all) => [...all, { id, role: "learner", text, analysis: "loading" }]);
    const history = turns();
    analyzeLearner(keyRef.current, settingsRef.current, history.slice(0, -1), text)
      .then((analysis) => patchMessage(id, { analysis }))
      .catch(() => patchMessage(id, { analysis: "error" }));
    await partnerMove();
  };

  // ---------- controls ----------

  const start = useCallback(async () => {
    setError(null);
    const perm = await ExpoSpeechRecognitionModule.requestPermissionsAsync();
    if (!perm.granted) {
      setError("Language Buddy needs the microphone and speech recognition. Turn them on in the Settings app.");
      return;
    }
    activeRef.current = true;
    restartCount.current = 0;
    if (messagesRef.current.length === 0) await partnerMove();
    else listen();
  }, []);

  const pause = () => {
    activeRef.current = false;
    clearTimers();
    stopRecognition("ignore");
    Speech.stop();
    setLiveText("");
    setHelpMode(false);
    setPhase("idle");
  };

  /** The big button: start, send now, or interrupt the partner. */
  const tapMain = () => {
    switch (phaseRef.current) {
      case "idle":
        start();
        break;
      case "listening":
        if (transcriptRef.current.trim()) finishTurn();
        break;
      case "speaking":
        Speech.stop();
        listen();
        break;
      case "thinking":
        break;
    }
  };

  /** Next thing you say is in your own language: "How do I say …?" */
  const toggleHelp = () => {
    const on = !helpRef.current;
    setHelpMode(on);
    if (!activeRef.current) {
      if (on) start();
      return;
    }
    if (phaseRef.current === "listening") {
      stopRecognition("ignore");
      setTimeout(listen, 250);
    } else if (phaseRef.current === "speaking") {
      Speech.stop();
      listen();
    }
  };

  /** Replay a line (optionally slower). Listening resumes afterwards if the conversation is running. */
  const replay = (text: string, rate?: number) => {
    if (phaseRef.current === "thinking") return;
    if (phaseRef.current === "listening") {
      clearTimers();
      stopRecognition("ignore");
    }
    speak(text, { rate });
  };

  const loadHints = async (id: string) => {
    const msg = messagesRef.current.find((m) => m.id === id);
    if (!msg || msg.role !== "partner" || (msg.hints && msg.hints !== "error")) return;
    patchMessage(id, { hints: "loading" });
    try {
      const idx = messagesRef.current.findIndex((m) => m.id === id);
      const history = messagesRef.current
        .slice(0, idx + 1)
        .flatMap((m): Turn[] => (m.role === "help" ? [] : [{ role: m.role, text: m.text }]));
      const hints = await hintsForLine(keyRef.current, settingsRef.current, history, msg.text);
      patchMessage(id, { hints });
    } catch {
      patchMessage(id, { hints: "error" });
    }
  };

  const restart = () => {
    pause();
    setError(null);
    updateMessages(() => []);
  };

  useEffect(() => () => pause(), []);

  return {
    messages,
    phase,
    liveText,
    helpMode,
    error,
    dismissError: () => setError(null),
    tapMain,
    pause,
    toggleHelp,
    replay,
    loadHints,
    restart,
  };
}

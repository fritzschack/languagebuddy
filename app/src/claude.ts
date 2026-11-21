import { Platform } from "react-native";
import Anthropic from "@anthropic-ai/sdk";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import { z } from "zod";
import { languageByLocale } from "./languages";
import type { ModelChoice, Settings } from "./settings";

export type Turn = { role: "partner" | "learner"; text: string };

// ---------- output schemas ----------

const ReplySchema = z.object({
  reply: z.string().describe("Your next line, only in the target language"),
  translation: z.string().describe("Natural translation of reply into the learner's native language"),
});
export type PartnerReply = z.infer<typeof ReplySchema>;

const AnalysisSchema = z.object({
  translation: z.string().describe("What the learner meant, in their native language"),
  is_natural: z.boolean(),
  corrected: z.string().nullable().describe("Their message rewritten correctly in the target language, or null if already natural"),
  explanation: z.string().nullable().describe("One or two short sentences in the native language explaining the main fix, or a short note of praise"),
});
export type LearnerAnalysis = z.infer<typeof AnalysisSchema>;

const HintsSchema = z.object({
  vocab: z.array(z.object({ word: z.string(), meaning: z.string() })),
  tip: z.string(),
  suggestions: z.array(z.object({ target: z.string(), native: z.string() })),
});
export type LineHints = z.infer<typeof HintsSchema>;

const HowToSaySchema = z.object({
  target: z.string(),
  note: z.string(),
});
export type HowToSay = z.infer<typeof HowToSaySchema>;

// ---------- client ----------

export class MissingApiKeyError extends Error {}

let cached: { key: string; client: Anthropic } | null = null;
function clientFor(apiKey: string | null): Anthropic {
  if (!apiKey) throw new MissingApiKeyError("Add your Claude API key in Settings.");
  if (cached?.key !== apiKey)
    cached = {
      key: apiKey,
      client: new Anthropic({
        apiKey,
        // In the web version the key belongs to the person using this browser,
        // who typed it in themselves; it is not embedded in the site.
        dangerouslyAllowBrowser: Platform.OS === "web",
      }),
    };
  return cached.client;
}

async function ask<T extends z.ZodType>(
  apiKey: string | null,
  model: ModelChoice,
  system: string,
  user: string,
  schema: T,
): Promise<z.infer<T>> {
  const client = clientFor(apiKey);
  // Haiku has no server-side refusal fallback; the larger models fall back automatically.
  const fallback =
    model === "claude-haiku-5-5"
      ? {}
      : { betas: ["server-side-fallback-2026-07-01"], fallbacks: "default" as const };
  const res = await client.beta.messages.parse({
    model,
    max_tokens: 8000,
    system,
    messages: [{ role: "user", content: user }],
    // Low effort keeps the voice loop snappy; these are short, well-specified tasks.
    output_config: { effort: "low", format: betaZodOutputFormat(schema) },
    ...fallback,
  });
  if (res.stop_reason === "refusal") throw new Error("Claude declined to answer that. Try rephrasing.");
  if (!res.parsed_output) throw new Error("Claude's answer couldn't be read. Try again.");
  return res.parsed_output as z.infer<T>;
}

function names(s: Settings) {
  return { target: languageByLocale(s.targetLocale).name, native: languageByLocale(s.nativeLocale).name };
}

function transcript(history: Turn[]): string {
  return history.map((t) => `${t.role === "partner" ? "PARTNER" : "LEARNER"}: ${t.text}`).join("\n");
}

// ---------- tasks ----------

/** The partner's next spoken line. Kept small so speech can start quickly. */
export function partnerReply(apiKey: string | null, s: Settings, history: Turn[]): Promise<PartnerReply> {
  const { target, native } = names(s);
  const system = `You are a warm, patient conversation partner in a spoken voice chat, helping someone practice ${target}. Their native language is ${native}. Their level: ${s.level}. Situation to role-play: ${s.topic}.

How to reply:
- Speak only ${target}. Keep it to 1–3 short sentences that sound natural out loud, matched to the learner's level (simple words and present tense for beginners).
- Usually end with a question or prompt that keeps the conversation going. Stay in the role-play.
- The learner's lines come from speech recognition, so ignore missing punctuation or odd capitalization.
- If the learner used ${native} or seems stuck, briefly model how to say it in ${target} inside your reply, then continue.
- If the learner asks you to repeat, slow down, or explain, do that in simple ${target}.
- No emoji, lists, or markdown: your words are read aloud.`;
  const user = history.length
    ? `Conversation so far:\n${transcript(history)}\n\nWrite the PARTNER's next line.`
    : `Open the conversation with a short greeting that sets up the situation.`;
  return ask(apiKey, s.model, system, user, ReplySchema);
}

/** Translation of, and feedback on, what the learner just said. Runs alongside partnerReply. */
export function analyzeLearner(apiKey: string | null, s: Settings, history: Turn[], said: string): Promise<LearnerAnalysis> {
  const { target, native } = names(s);
  const system = `You help a ${s.level} learner of ${target} (native language: ${native}). Their message came from speech recognition, so do not correct punctuation, capitalization, or accents the recognizer may drop. Only correct real grammar, vocabulary, or word-order mistakes, and the most important one first. Write translation and explanation in ${native}. If the message is fully natural, set is_natural true, corrected null, and give a few words of praise as the explanation. If they spoke ${native} instead, set is_natural false and put the ${target} way to say it in corrected.`;
  const recent = transcript(history.slice(-6));
  const user = `Recent conversation:\n${recent || "(none)"}\n\nThe learner just said: "${said}"`;
  return ask(apiKey, s.model, system, user, AnalysisSchema);
}

/** Vocabulary, a tip, and possible answers for one partner line. Fetched when the learner taps Hints. */
export function hintsForLine(apiKey: string | null, s: Settings, history: Turn[], line: string): Promise<LineHints> {
  const { target, native } = names(s);
  const system = `You help a ${s.level} learner of ${target} (native language: ${native}) answer their conversation partner. Give 2–4 vocab items from the partner's line that this learner may not know (meanings in ${native}), one short tip in ${native} on how to answer (mention a useful structure), and 2 level-appropriate answers in ${target} with ${native} meanings.`;
  const user = `Recent conversation:\n${transcript(history.slice(-6))}\n\nThe partner's line to explain: "${line}"`;
  return ask(apiKey, s.model, system, user, HintsSchema);
}

/** "How do I say …?" — the learner asks in their native language. */
export function howToSay(apiKey: string | null, s: Settings, history: Turn[], question: string): Promise<HowToSay> {
  const { target, native } = names(s);
  const system = `A ${s.level} learner of ${target} (native language: ${native}) is in a spoken conversation and wants to say something. Give the most natural ${target} phrasing at their level as "target", and one short note in ${native} about a key word or grammar point as "note".`;
  const user = `Recent conversation:\n${transcript(history.slice(-4)) || "(none)"}\n\nWhat they want to say (spoken in ${native}): "${question}"`;
  return ask(apiKey, s.model, system, user, HowToSaySchema);
}

export function describeError(e: unknown): string {
  if (e instanceof MissingApiKeyError) return e.message;
  if (e instanceof Anthropic.AuthenticationError) return "Your Claude API key was rejected. Check it in Settings.";
  if (e instanceof Anthropic.RateLimitError) return "Too many requests right now. Wait a moment, then tap the button to continue.";
  if (e instanceof Anthropic.APIConnectionError) return "Can't reach Claude. Check your connection, then tap to continue.";
  if (e instanceof Anthropic.APIError) return `Claude returned an error (${e.status}). Tap to try again.`;
  if (e instanceof Error) return e.message;
  return "Something went wrong. Tap to try again.";
}

import { useEffect, useRef, useState } from "react";
import { Animated, Easing, FlatList, Pressable, StyleSheet, Text, View } from "react-native";
import { StatusBar } from "expo-status-bar";
import { SafeAreaProvider, SafeAreaView } from "react-native-safe-area-context";
import { MessageBubble } from "./src/components/MessageBubble";
import { SettingsSheet } from "./src/components/SettingsSheet";
import { languageByLocale } from "./src/languages";
import { DEFAULT_SETTINGS, loadApiKey, loadSettings, saveApiKey, saveSettings, type Settings } from "./src/settings";
import { useTheme, type Theme } from "./src/theme";
import { useConversation, type Phase } from "./src/useConversation";

export default function App() {
  return (
    <SafeAreaProvider>
      <Main />
    </SafeAreaProvider>
  );
}

function Main() {
  const t = useTheme();
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);
  const [apiKey, setApiKey] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [showTranslations, setShowTranslations] = useState(false);

  useEffect(() => {
    Promise.all([loadSettings(), loadApiKey()]).then(([s, k]) => {
      setSettings(s);
      setShowTranslations(s.alwaysShowTranslations);
      setApiKey(k);
      setReady(true);
      if (!k) setSettingsOpen(true);
    });
  }, []);

  const convo = useConversation(settings, apiKey);
  const listRef = useRef<FlatList>(null);
  const target = languageByLocale(settings.targetLocale).name;
  const native = languageByLocale(settings.nativeLocale).name;

  const closeSettings = async (next: Settings, key: string) => {
    setSettingsOpen(false);
    const changedLanguage =
      next.targetLocale !== settings.targetLocale ||
      next.nativeLocale !== settings.nativeLocale ||
      next.topic !== settings.topic;
    if (changedLanguage && convo.messages.length) convo.restart();
    if (next.alwaysShowTranslations !== settings.alwaysShowTranslations) setShowTranslations(next.alwaysShowTranslations);
    setSettings(next);
    await saveSettings(next);
    if (key !== (apiKey ?? "")) {
      await saveApiKey(key);
      setApiKey(key.trim() || null);
    }
  };

  return (
    <SafeAreaView style={[styles.root, { backgroundColor: t.bg }]} edges={["top", "left", "right"]}>
      <StatusBar style="auto" />
      <View style={styles.header}>
        <View style={{ flexShrink: 1 }}>
          <Text style={[styles.title, { color: t.ink }]}>
            Language <Text style={{ color: t.accent }}>Buddy</Text>
          </Text>
          <Text style={{ color: t.muted, fontSize: 13 }} numberOfLines={1}>
            {target} · {settings.topic}
          </Text>
        </View>
        <View style={styles.headerButtons}>
          <HeaderButton
            theme={t}
            label={showTranslations ? `Hide ${shortName(native)}` : `Show ${shortName(native)}`}
            active={showTranslations}
            onPress={() => setShowTranslations(!showTranslations)}
          />
          <HeaderButton
            theme={t}
            label="Settings"
            onPress={() => {
              convo.pause();
              setSettingsOpen(true);
            }}
          />
        </View>
      </View>

      <FlatList
        ref={listRef}
        data={convo.messages}
        keyExtractor={(m) => m.id}
        contentContainerStyle={styles.list}
        onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: true })}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={[styles.emptyTitle, { color: t.ink }]}>Talk with Claude in {target}</Text>
            <Text style={{ color: t.muted, textAlign: "center", lineHeight: 21 }}>
              Tap the button and the conversation runs hands-free: Claude speaks, then listens. Pause for a moment when
              you're done talking. Tap any line to see it in {shortName(native)}, or tap Hints when you're stuck.
            </Text>
          </View>
        }
        renderItem={({ item }) => (
          <MessageBubble
            message={item}
            theme={t}
            showTranslations={showTranslations}
            onReplay={convo.replay}
            onHints={convo.loadHints}
            onUseSuggestion={(text) => convo.replay(text)}
          />
        )}
      />

      <SafeAreaView edges={["bottom"]} style={[styles.footer, { borderTopColor: t.line, backgroundColor: t.bg }]}>
        {convo.error ? (
          <Pressable onPress={convo.dismissError}>
            <Text style={[styles.error, { color: t.danger }]}>{convo.error}</Text>
          </Pressable>
        ) : null}
        <Text style={[styles.live, { color: convo.liveText ? t.ink : t.muted }]} numberOfLines={3}>
          {convo.liveText || statusLine(convo.phase, convo.helpMode, target, native)}
        </Text>
        <View style={styles.controls}>
          <SideButton
            theme={t}
            label={convo.helpMode ? `Back to ${shortName(target)}` : `Ask in ${shortName(native)}`}
            active={convo.helpMode}
            onPress={convo.toggleHelp}
          />
          <MainButton theme={t} phase={convo.phase} helpMode={convo.helpMode} onPress={convo.tapMain} />
          <SideButton
            theme={t}
            label={convo.phase === "idle" ? (convo.messages.length ? "New chat" : " ") : "Pause"}
            onPress={() => (convo.phase === "idle" ? convo.messages.length && convo.restart() : convo.pause())}
          />
        </View>
      </SafeAreaView>

      {ready && (
        <SettingsSheet visible={settingsOpen} theme={t} settings={settings} apiKey={apiKey} onClose={closeSettings} />
      )}
    </SafeAreaView>
  );
}

const shortName = (name: string) => name.replace(/\s*\(.*\)/, "");

function statusLine(phase: Phase, help: boolean, target: string, native: string): string {
  switch (phase) {
    case "idle":
      return "Tap to start talking";
    case "listening":
      return help ? `Say it in ${shortName(native)}: “How do I say…”` : `Listening in ${shortName(target)}…`;
    case "thinking":
      return "Thinking…";
    case "speaking":
      return "Tap to interrupt";
  }
}

function MainButton({ theme: t, phase, helpMode, onPress }: { theme: Theme; phase: Phase; helpMode: boolean; onPress: () => void }) {
  const pulse = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (phase === "listening" || phase === "speaking") {
      const loop = Animated.loop(
        Animated.sequence([
          Animated.timing(pulse, { toValue: 1, duration: 900, easing: Easing.out(Easing.quad), useNativeDriver: true }),
          Animated.timing(pulse, { toValue: 0, duration: 900, easing: Easing.in(Easing.quad), useNativeDriver: true }),
        ]),
      );
      loop.start();
      return () => loop.stop();
    }
    pulse.setValue(0);
  }, [phase]);

  const color = phase === "listening" ? (helpMode ? "#f2b33d" : t.listening) : t.accent;
  const label = { idle: "Start", listening: "Send", thinking: "…", speaking: "Talk" }[phase];
  return (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={label}>
      <View style={styles.mainWrap}>
        <Animated.View
          style={[
            styles.halo,
            {
              backgroundColor: color,
              opacity: pulse.interpolate({ inputRange: [0, 1], outputRange: [0.15, 0.35] }),
              transform: [{ scale: pulse.interpolate({ inputRange: [0, 1], outputRange: [1, 1.25] }) }],
            },
          ]}
        />
        <View style={[styles.main, { backgroundColor: color }]}>
          <Text style={[styles.mainLabel, { color: t.accentInk }]}>{label}</Text>
        </View>
      </View>
    </Pressable>
  );
}

function SideButton({ theme: t, label, onPress, active }: { theme: Theme; label: string; onPress: () => void; active?: boolean }) {
  return (
    <Pressable onPress={onPress} style={styles.side} accessibilityRole="button">
      <Text style={{ color: active ? t.hintInk : t.accent, fontWeight: "600", textAlign: "center" }}>{label}</Text>
    </Pressable>
  );
}

function HeaderButton({ theme: t, label, onPress, active }: { theme: Theme; label: string; onPress: () => void; active?: boolean }) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      style={[styles.headerBtn, { borderColor: active ? t.accent : t.line, backgroundColor: active ? t.accentSoft : t.surface }]}
    >
      <Text style={{ color: t.ink, fontSize: 13, fontWeight: "500" }}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 16, paddingVertical: 10, gap: 10 },
  title: { fontSize: 22, fontWeight: "700" },
  headerButtons: { flexDirection: "row", gap: 6 },
  headerBtn: { borderWidth: 1, borderRadius: 999, paddingVertical: 6, paddingHorizontal: 12 },
  list: { padding: 16, gap: 16, flexGrow: 1 },
  empty: { flex: 1, alignItems: "center", justifyContent: "center", gap: 10, paddingHorizontal: 12 },
  emptyTitle: { fontSize: 20, fontWeight: "700", textAlign: "center" },
  footer: { borderTopWidth: StyleSheet.hairlineWidth, paddingHorizontal: 16, paddingTop: 10, gap: 8 },
  error: { textAlign: "center", fontSize: 14 },
  live: { textAlign: "center", fontSize: 16, minHeight: 22 },
  controls: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingBottom: 8 },
  side: { width: 96, paddingVertical: 10 },
  mainWrap: { width: 96, height: 96, alignItems: "center", justifyContent: "center" },
  halo: { position: "absolute", width: 96, height: 96, borderRadius: 48 },
  main: { width: 76, height: 76, borderRadius: 38, alignItems: "center", justifyContent: "center" },
  mainLabel: { fontSize: 16, fontWeight: "700" },
});

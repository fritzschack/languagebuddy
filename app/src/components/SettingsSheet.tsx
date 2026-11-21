import { useEffect, useState } from "react";
import { Modal, Platform, Pressable, ScrollView, StyleSheet, Switch, Text, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { LANGUAGES, LEVELS, TOPICS, languageByLocale } from "../languages";
import { MODEL_OPTIONS, type Settings } from "../settings";
import type { Theme } from "../theme";

type Props = {
  visible: boolean;
  theme: Theme;
  settings: Settings;
  apiKey: string | null;
  onClose: (next: Settings, apiKey: string) => void;
};

/** A row that expands into a list of choices. */
function Choice<T extends string>({
  label,
  value,
  display,
  options,
  onChange,
  theme: t,
}: {
  label: string;
  value: T;
  display: string;
  options: { value: T; label: string; note?: string }[];
  onChange: (v: T) => void;
  theme: Theme;
}) {
  const [open, setOpen] = useState(false);
  return (
    <View style={[styles.group, { backgroundColor: t.surface, borderColor: t.line }]}>
      <Pressable style={styles.row} onPress={() => setOpen(!open)} accessibilityRole="button">
        <Text style={[styles.rowLabel, { color: t.muted }]}>{label}</Text>
        <Text style={[styles.rowValue, { color: t.ink }]}>{display}</Text>
      </Pressable>
      {open &&
        options.map((o) => (
          <Pressable
            key={o.value}
            onPress={() => {
              onChange(o.value);
              setOpen(false);
            }}
            style={[styles.option, { borderTopColor: t.line }]}
          >
            <Text style={{ color: o.value === value ? t.accent : t.ink, fontWeight: o.value === value ? "600" : "400" }}>
              {o.label}
            </Text>
            {o.note ? <Text style={{ color: t.muted, fontSize: 13 }}>{o.note}</Text> : null}
          </Pressable>
        ))}
    </View>
  );
}

function Stepper({
  label,
  value,
  format,
  step,
  min,
  max,
  onChange,
  theme: t,
}: {
  label: string;
  value: number;
  format: (v: number) => string;
  step: number;
  min: number;
  max: number;
  onChange: (v: number) => void;
  theme: Theme;
}) {
  const clamp = (v: number) => Math.min(max, Math.max(min, Math.round(v * 100) / 100));
  const Btn = ({ sign }: { sign: 1 | -1 }) => (
    <Pressable
      onPress={() => onChange(clamp(value + sign * step))}
      style={[styles.stepBtn, { borderColor: t.line }]}
      accessibilityLabel={`${sign > 0 ? "Increase" : "Decrease"} ${label}`}
    >
      <Text style={{ color: t.accent, fontSize: 18, fontWeight: "600" }}>{sign > 0 ? "+" : "−"}</Text>
    </Pressable>
  );
  return (
    <View style={[styles.group, styles.row, { backgroundColor: t.surface, borderColor: t.line }]}>
      <Text style={[styles.rowLabel, { color: t.muted }]}>{label}</Text>
      <View style={styles.stepper}>
        <Btn sign={-1} />
        <Text style={{ color: t.ink, minWidth: 56, textAlign: "center" }}>{format(value)}</Text>
        <Btn sign={1} />
      </View>
    </View>
  );
}

export function SettingsSheet({ visible, theme: t, settings, apiKey, onClose }: Props) {
  const [draft, setDraft] = useState(settings);
  const [key, setKey] = useState(apiKey ?? "");
  useEffect(() => {
    if (visible) {
      setDraft(settings);
      setKey(apiKey ?? "");
    }
  }, [visible]);
  const set = <K extends keyof Settings>(k: K, v: Settings[K]) => setDraft((d) => ({ ...d, [k]: v }));
  const langOptions = LANGUAGES.map((l) => ({ value: l.locale, label: l.name }));

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => onClose(draft, key)}>
      <SafeAreaView style={{ flex: 1, backgroundColor: t.bg }} edges={["top", "bottom"]}>
        <View style={[styles.header, { borderBottomColor: t.line }]}>
          <Text style={[styles.title, { color: t.ink }]}>Settings</Text>
          <Pressable onPress={() => onClose(draft, key)} accessibilityRole="button">
            <Text style={{ color: t.accent, fontSize: 17, fontWeight: "600" }}>Done</Text>
          </Pressable>
        </View>
        <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
          <Text style={[styles.section, { color: t.muted }]}>Practice</Text>
          <Choice
            theme={t}
            label="I'm practicing"
            value={draft.targetLocale}
            display={languageByLocale(draft.targetLocale).name}
            options={langOptions}
            onChange={(v) => set("targetLocale", v)}
          />
          <Choice
            theme={t}
            label="My language"
            value={draft.nativeLocale}
            display={languageByLocale(draft.nativeLocale).name}
            options={langOptions}
            onChange={(v) => set("nativeLocale", v)}
          />
          <Choice
            theme={t}
            label="Level"
            value={draft.level}
            display={draft.level}
            options={LEVELS.map((l) => ({ value: l, label: l }))}
            onChange={(v) => set("level", v)}
          />
          <Choice
            theme={t}
            label="Situation"
            value={draft.topic}
            display={draft.topic}
            options={TOPICS.map((l) => ({ value: l, label: l }))}
            onChange={(v) => set("topic", v)}
          />

          <Text style={[styles.section, { color: t.muted }]}>Voice</Text>
          <Stepper
            theme={t}
            label="Partner's speed"
            value={draft.speechRate}
            format={(v) => `${v.toFixed(2)}×`}
            step={0.05}
            min={0.5}
            max={1.2}
            onChange={(v) => set("speechRate", v)}
          />
          <Stepper
            theme={t}
            label="Pause that ends my turn"
            value={draft.silenceMs / 1000}
            format={(v) => `${v.toFixed(1)} s`}
            step={0.2}
            min={0.8}
            max={4}
            onChange={(v) => set("silenceMs", Math.round(v * 1000))}
          />
          <View style={[styles.group, styles.row, { backgroundColor: t.surface, borderColor: t.line }]}>
            <Text style={[styles.rowLabel, { color: t.muted, flex: 1 }]}>Always show translations</Text>
            <Switch
              value={draft.alwaysShowTranslations}
              onValueChange={(v) => set("alwaysShowTranslations", v)}
              trackColor={{ true: t.accent }}
            />
          </View>

          <Text style={[styles.section, { color: t.muted }]}>Claude</Text>
          <Choice
            theme={t}
            label="Model"
            value={draft.model}
            display={MODEL_OPTIONS.find((m) => m.id === draft.model)?.label ?? draft.model}
            options={MODEL_OPTIONS.map((m) => ({ value: m.id, label: m.label, note: m.note }))}
            onChange={(v) => set("model", v)}
          />
          <View style={[styles.group, { backgroundColor: t.surface, borderColor: t.line, padding: 12, gap: 6 }]}>
            <Text style={[styles.rowLabel, { color: t.muted }]}>API key</Text>
            <TextInput
              value={key}
              onChangeText={setKey}
              placeholder="sk-ant-…"
              placeholderTextColor={t.muted}
              autoCapitalize="none"
              autoCorrect={false}
              secureTextEntry
              style={[styles.input, { color: t.ink, borderColor: t.line }]}
            />
            <Text style={{ color: t.muted, fontSize: 13 }}>
              Create one at platform.claude.com under API keys.{" "}
              {Platform.OS === "web"
                ? "It stays in this browser on this device and is only sent to Claude, never to the website."
                : "It's stored in your phone's keychain and only sent to Claude."}
            </Text>
          </View>
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  title: { fontSize: 20, fontWeight: "700" },
  body: { padding: 16, gap: 10 },
  section: { fontSize: 12, fontWeight: "700", letterSpacing: 0.8, textTransform: "uppercase", marginTop: 10 },
  group: { borderRadius: 12, borderWidth: StyleSheet.hairlineWidth, overflow: "hidden" },
  row: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", padding: 12, gap: 12 },
  rowLabel: { fontSize: 14 },
  rowValue: { fontSize: 15, fontWeight: "500", flexShrink: 1, textAlign: "right" },
  option: { paddingVertical: 10, paddingHorizontal: 16, borderTopWidth: StyleSheet.hairlineWidth },
  stepper: { flexDirection: "row", alignItems: "center", gap: 6 },
  stepBtn: { width: 36, height: 36, borderRadius: 18, borderWidth: 1, alignItems: "center", justifyContent: "center" },
  input: { borderWidth: 1, borderRadius: 8, padding: 10, fontSize: 15 },
});

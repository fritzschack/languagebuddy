import { useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";
import type { Message } from "../useConversation";
import type { Theme } from "../theme";

type Props = {
  message: Message;
  theme: Theme;
  showTranslations: boolean;
  onReplay: (text: string, rate?: number) => void;
  onHints: (id: string) => void;
  onUseSuggestion: (text: string) => void;
};

export function MessageBubble({ message, theme: t, showTranslations, onReplay, onHints, onUseSuggestion }: Props) {
  // Per-line override of the global "show translations" switch.
  const [revealed, setRevealed] = useState<boolean | null>(null);
  const [hintsOpen, setHintsOpen] = useState(false);
  const showTr = revealed ?? showTranslations;

  const Chip = ({ label, onPress, active }: { label: string; onPress: () => void; active?: boolean }) => (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      style={({ pressed }) => [
        styles.chip,
        { borderColor: active ? t.accent : t.line, backgroundColor: active ? t.accentSoft : t.surface },
        pressed && { opacity: 0.6 },
      ]}
    >
      <Text style={[styles.chipText, { color: t.ink }]}>{label}</Text>
    </Pressable>
  );

  if (message.role === "help") {
    return (
      <View style={[styles.help, { backgroundColor: t.hint }]}>
        <Text style={[styles.label, { color: t.hintInk }]}>How to say “{message.question}”</Text>
        <Text style={[styles.helpTarget, { color: t.ink }]}>{message.answer.target}</Text>
        <Text style={{ color: t.ink }}>{message.answer.note}</Text>
        <View style={styles.chips}>
          <Chip label="Play" onPress={() => onReplay(message.answer.target)} />
          <Chip label="Slower" onPress={() => onReplay(message.answer.target, 0.7)} />
        </View>
      </View>
    );
  }

  if (message.role === "learner") {
    const a = message.analysis;
    return (
      <View style={[styles.turn, styles.right]}>
        <Text style={[styles.who, { color: t.muted }]}>You</Text>
        <Pressable onPress={() => setRevealed(!showTr)} accessibilityHint="Shows or hides the translation">
          <View style={[styles.bubble, styles.userBubble, { backgroundColor: t.user }]}>
            <Text style={[styles.text, { color: t.userInk }]}>{message.text}</Text>
          </View>
        </Pressable>
        {a === "loading" ? (
          <ActivityIndicator size="small" color={t.muted} />
        ) : a === "error" ? (
          <Text style={[styles.translation, { color: t.muted }]}>Couldn't check this line.</Text>
        ) : (
          <>
            {showTr && <Text style={[styles.translation, styles.alignRight, { color: t.muted }]}>{a.translation}</Text>}
            <View
              style={[
                styles.fix,
                { backgroundColor: t.surface, borderLeftColor: a.is_natural ? t.accent : "#f2b33d" },
              ]}
            >
              {!a.is_natural && a.corrected ? (
                <>
                  <Text style={[styles.better, { color: t.ink }]}>{a.corrected}</Text>
                  {a.explanation ? <Text style={{ color: t.muted }}>{a.explanation}</Text> : null}
                  <View style={styles.chips}>
                    <Chip label="Hear it" onPress={() => onReplay(a.corrected!)} />
                  </View>
                </>
              ) : (
                <Text style={{ color: t.muted }}>{a.explanation || "Sounds natural."}</Text>
              )}
            </View>
          </>
        )}
      </View>
    );
  }

  // Partner line
  const h = message.hints;
  return (
    <View style={[styles.turn, styles.left]}>
      <Text style={[styles.who, { color: t.muted }]}>Partner</Text>
      <Pressable onPress={() => setRevealed(!showTr)} accessibilityHint="Shows or hides the translation">
        <View style={[styles.bubble, styles.partnerBubble, { backgroundColor: t.surface, borderColor: t.line }]}>
          <Text style={[styles.text, { color: t.ink }]}>{message.text}</Text>
        </View>
      </Pressable>
      {showTr && <Text style={[styles.translation, { color: t.muted }]}>{message.translation}</Text>}
      <View style={styles.chips}>
        <Chip label="Play" onPress={() => onReplay(message.text)} />
        <Chip label="Slower" onPress={() => onReplay(message.text, 0.7)} />
        <Chip label="Translate" active={showTr} onPress={() => setRevealed(!showTr)} />
        <Chip
          label="Hints"
          active={hintsOpen}
          onPress={() => {
            setHintsOpen(!hintsOpen);
            if (!hintsOpen) onHints(message.id);
          }}
        />
      </View>
      {hintsOpen && (
        <View style={[styles.hints, { backgroundColor: t.hint }]}>
          {h === "loading" || h === null ? (
            <ActivityIndicator size="small" color={t.hintInk} />
          ) : h === "error" ? (
            <Pressable onPress={() => onHints(message.id)}>
              <Text style={{ color: t.ink }}>Couldn't load hints. Tap to try again.</Text>
            </Pressable>
          ) : (
            <>
              <Text style={[styles.label, { color: t.hintInk }]}>Key words</Text>
              {h.vocab.map((v) => (
                <Text key={v.word} style={{ color: t.ink }}>
                  <Text style={{ fontWeight: "600" }}>{v.word}</Text>  {v.meaning}
                </Text>
              ))}
              <Text style={[styles.label, { color: t.hintInk }]}>Tip</Text>
              <Text style={{ color: t.ink }}>{h.tip}</Text>
              <Text style={[styles.label, { color: t.hintInk }]}>You could say</Text>
              {h.suggestions.map((s) => (
                <Pressable
                  key={s.target}
                  onPress={() => onUseSuggestion(s.target)}
                  style={[styles.suggestion, { backgroundColor: t.surface, borderColor: t.line }]}
                >
                  <Text style={{ color: t.ink, fontWeight: "500" }}>{s.target}</Text>
                  <Text style={{ color: t.muted, fontSize: 13 }}>{s.native}</Text>
                </Pressable>
              ))}
            </>
          )}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  turn: { maxWidth: "88%", gap: 6 },
  left: { alignSelf: "flex-start" },
  right: { alignSelf: "flex-end", alignItems: "flex-end" },
  who: { fontSize: 11, fontWeight: "600", letterSpacing: 0.6, textTransform: "uppercase" },
  bubble: { paddingVertical: 10, paddingHorizontal: 14, borderRadius: 18 },
  partnerBubble: { borderWidth: StyleSheet.hairlineWidth, borderBottomLeftRadius: 6 },
  userBubble: { borderBottomRightRadius: 6 },
  text: { fontSize: 18, lineHeight: 25 },
  translation: { fontSize: 15, fontStyle: "italic", paddingHorizontal: 4 },
  alignRight: { textAlign: "right" },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  chip: { borderWidth: 1, borderRadius: 999, paddingVertical: 5, paddingHorizontal: 11 },
  chipText: { fontSize: 13 },
  fix: { borderLeftWidth: 3, borderRadius: 8, padding: 10, gap: 4, maxWidth: "100%" },
  better: { fontWeight: "600", fontSize: 16 },
  hints: { borderRadius: 12, padding: 12, gap: 6 },
  label: { fontSize: 11, fontWeight: "700", letterSpacing: 0.7, textTransform: "uppercase", marginTop: 4 },
  suggestion: { borderWidth: 1, borderRadius: 10, padding: 8, gap: 2 },
  help: { alignSelf: "stretch", borderRadius: 12, padding: 12, gap: 6 },
  helpTarget: { fontSize: 18, fontWeight: "600" },
});

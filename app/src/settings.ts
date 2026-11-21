import { Platform } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as SecureStore from "expo-secure-store";
import { LEVELS, TOPICS } from "./languages";

export type ModelChoice = "claude-opus-5-5" | "claude-sonnet-5-5" | "claude-haiku-5-5";

export const MODEL_OPTIONS: { id: ModelChoice; label: string; note: string }[] = [
  { id: "claude-opus-5-5", label: "Opus 5.5", note: "Best corrections and explanations" },
  { id: "claude-sonnet-5-5", label: "Sonnet 5.5", note: "Balanced" },
  { id: "claude-haiku-5-5", label: "Haiku 5.5", note: "Fastest replies, lowest cost" },
];

export type Settings = {
  targetLocale: string;
  nativeLocale: string;
  level: string;
  topic: string;
  model: ModelChoice;
  /** Text-to-speech rate, 1 = normal. */
  speechRate: number;
  /** How long a pause (ms) ends your turn in hands-free mode. */
  silenceMs: number;
  /** Show translations under every line instead of tap-to-reveal. */
  alwaysShowTranslations: boolean;
};

export const DEFAULT_SETTINGS: Settings = {
  targetLocale: "es-ES",
  nativeLocale: "en-US",
  level: LEVELS[1],
  topic: TOPICS[0],
  model: "claude-haiku-5-5",
  speechRate: 0.9,
  silenceMs: 1600,
  alwaysShowTranslations: false,
};

const SETTINGS_KEY = "language-buddy/settings/v1";
const API_KEY_KEY = "anthropic-api-key";

export async function loadSettings(): Promise<Settings> {
  try {
    const raw = await AsyncStorage.getItem(SETTINGS_KEY);
    return raw ? { ...DEFAULT_SETTINGS, ...JSON.parse(raw) } : DEFAULT_SETTINGS;
  } catch {
    return DEFAULT_SETTINGS;
  }
}

export async function saveSettings(s: Settings): Promise<void> {
  try {
    await AsyncStorage.setItem(SETTINGS_KEY, JSON.stringify(s));
  } catch {
    // Settings are a convenience; the app still works with defaults.
  }
}

// On iPhone the key goes in the keychain. In the browser it stays in this
// device's local storage: it is never part of the website or sent anywhere but Claude.
const isWeb = Platform.OS === "web";

export async function loadApiKey(): Promise<string | null> {
  try {
    if (isWeb) return await AsyncStorage.getItem(API_KEY_KEY);
    return await SecureStore.getItemAsync(API_KEY_KEY);
  } catch {
    return null;
  }
}

export async function saveApiKey(key: string): Promise<void> {
  if (isWeb) {
    if (key.trim()) await AsyncStorage.setItem(API_KEY_KEY, key.trim());
    else await AsyncStorage.removeItem(API_KEY_KEY);
    return;
  }
  if (key.trim()) await SecureStore.setItemAsync(API_KEY_KEY, key.trim());
  else await SecureStore.deleteItemAsync(API_KEY_KEY);
}

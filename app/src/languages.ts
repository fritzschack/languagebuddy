export type Language = {
  /** Shown in pickers and sent to Claude. */
  name: string;
  /** Locale for speech recognition and text-to-speech. */
  locale: string;
};

export const LANGUAGES: Language[] = [
  { name: "Spanish (Spain)", locale: "es-ES" },
  { name: "Spanish (Mexico)", locale: "es-MX" },
  { name: "English (US)", locale: "en-US" },
  { name: "English (UK)", locale: "en-GB" },
  { name: "French", locale: "fr-FR" },
  { name: "German", locale: "de-DE" },
  { name: "Italian", locale: "it-IT" },
  { name: "Portuguese (Brazil)", locale: "pt-BR" },
  { name: "Portuguese (Portugal)", locale: "pt-PT" },
  { name: "Dutch", locale: "nl-NL" },
  { name: "Swedish", locale: "sv-SE" },
  { name: "Polish", locale: "pl-PL" },
  { name: "Greek", locale: "el-GR" },
  { name: "Turkish", locale: "tr-TR" },
  { name: "Russian", locale: "ru-RU" },
  { name: "Arabic", locale: "ar-SA" },
  { name: "Hindi", locale: "hi-IN" },
  { name: "Japanese", locale: "ja-JP" },
  { name: "Korean", locale: "ko-KR" },
  { name: "Mandarin Chinese", locale: "zh-CN" },
];

export const LEVELS = ["Beginner (A1–A2)", "Intermediate (B1–B2)", "Advanced (C1–C2)"];

export const TOPICS = [
  "Free chat about my day",
  "Ordering at a café",
  "Asking for directions",
  "Checking into a hotel",
  "Meeting a new friend",
  "At the doctor",
  "Job interview",
  "Shopping at a market",
  "Movies, music and books",
  "Travel plans",
];

export const languageByLocale = (locale: string): Language =>
  LANGUAGES.find((l) => l.locale === locale) ?? LANGUAGES[0];

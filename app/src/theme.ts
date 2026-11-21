import { useColorScheme } from "react-native";

const light = {
  bg: "#eef2f1",
  surface: "#ffffff",
  ink: "#12302c",
  muted: "#5b716d",
  line: "#d3dedb",
  accent: "#0f7a68",
  accentInk: "#ffffff",
  accentSoft: "#d7efe9",
  hint: "#fdf0d4",
  hintInk: "#6b4a05",
  user: "#163f39",
  userInk: "#eaf6f3",
  danger: "#b3412f",
  listening: "#c2452f",
};

const dark: typeof light = {
  bg: "#0d1a18",
  surface: "#142623",
  ink: "#e3efec",
  muted: "#93aaa5",
  line: "#27403b",
  accent: "#3cc2a6",
  accentInk: "#06201b",
  accentSoft: "#173a33",
  hint: "#3a2f17",
  hintInk: "#f8d58e",
  user: "#2a6f63",
  userInk: "#f1fbf8",
  danger: "#ee8a77",
  listening: "#e0634b",
};

export type Theme = typeof light;
export const useTheme = (): Theme => (useColorScheme() === "dark" ? dark : light);

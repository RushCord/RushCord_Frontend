import { create } from "zustand";
import { DEFAULT_THEME, normalizeTheme } from "../constants";

const STORAGE_KEY = "chat-theme";

const readStoredTheme = () => {
  try {
    return normalizeTheme(localStorage.getItem(STORAGE_KEY));
  } catch {
    return DEFAULT_THEME;
  }
};

const initialTheme = readStoredTheme();

try {
  localStorage.setItem(STORAGE_KEY, initialTheme);
} catch {
  // ignore quota / private mode
}

export const useThemeStore = create((set) => ({
  theme: initialTheme,
  setTheme: (nextTheme) => {
    const theme = normalizeTheme(nextTheme);
    try {
      localStorage.setItem(STORAGE_KEY, theme);
    } catch {
      // ignore
    }
    set({ theme });
  },
}));

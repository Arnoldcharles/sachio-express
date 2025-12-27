import React, { createContext, useContext, useEffect, useMemo, useState } from "react";
import { useColorScheme } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";

export type ThemePreference = "system" | "light" | "dark";

type ThemeColors = {
  background: string;
  surface: string;
  card: string;
  text: string;
  muted: string;
  border: string;
  primary: string;
  danger: string;
  overlay: string;
};

const lightColors: ThemeColors = {
  background: "#FAFBFB",
  surface: "#FFFFFF",
  card: "#FFFFFF",
  text: "#1E293B",
  muted: "#64748B",
  border: "#E0E0E0",
  primary: "#0B6E6B",
  danger: "#EF4444",
  overlay: "rgba(0,0,0,0.3)",
};

const darkColors: ThemeColors = {
  background: "#0B0F10",
  surface: "#12181B",
  card: "#111827",
  text: "#E5E7EB",
  muted: "#9CA3AF",
  border: "#1F2937",
  primary: "#2DD4BF",
  danger: "#F87171",
  overlay: "rgba(0,0,0,0.6)",
};

type ThemeContextValue = {
  preference: ThemePreference;
  setPreference: (value: ThemePreference) => void;
  colors: ThemeColors;
  isDark: boolean;
};

const ThemeContext = createContext<ThemeContextValue | null>(null);

const STORAGE_KEY = "themePreference";

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const systemScheme = useColorScheme();
  const [preference, setPreferenceState] = useState<ThemePreference>("system");

  useEffect(() => {
    const load = async () => {
      try {
        const stored = await AsyncStorage.getItem(STORAGE_KEY);
        if (stored === "light" || stored === "dark" || stored === "system") {
          setPreferenceState(stored);
        }
      } catch {
        // ignore preference load errors
      }
    };
    load();
  }, []);

  const setPreference = (value: ThemePreference) => {
    setPreferenceState(value);
    AsyncStorage.setItem(STORAGE_KEY, value).catch(() => {});
  };

  const isDark =
    preference === "dark" || (preference === "system" && systemScheme === "dark");
  const colors = useMemo(() => (isDark ? darkColors : lightColors), [isDark]);

  const value = useMemo(
    () => ({ preference, setPreference, colors, isDark }),
    [preference, colors, isDark]
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) {
    throw new Error("useTheme must be used within ThemeProvider");
  }
  return ctx;
}

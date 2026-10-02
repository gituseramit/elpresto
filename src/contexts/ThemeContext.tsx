"use client";

import {
  createContext,
  useLayoutEffect,
  useContext,
  useMemo,
  useSyncExternalStore,
  type ReactNode,
} from "react";

export type ThemePreference = "system" | "light" | "dark";
export type ResolvedTheme = "light" | "dark";

export const THEME_STORAGE_KEY = "elpestro_theme_preference";
const THEME_CHANGE_EVENT = "elp-presto-theme-change";

type ThemeContextValue = {
  preference: ThemePreference;
  resolvedTheme: ResolvedTheme;
  setPreference: (preference: ThemePreference) => void;
};

const ThemeContext = createContext<ThemeContextValue | null>(null);

function isThemePreference(value: unknown): value is ThemePreference {
  return value === "system" || value === "light" || value === "dark";
}

function readPreference(): ThemePreference {
  try {
    const saved = window.localStorage.getItem(THEME_STORAGE_KEY);
    if (isThemePreference(saved)) return saved;

    const path = window.location.pathname;
    const legacyKeys = path.startsWith("/developer")
      ? ["elpestro_dev_theme", "elpestro_kitchen_theme"]
      : path.startsWith("/kitchen")
        ? ["elpestro_kitchen_theme", "elpestro_dev_theme"]
        : ["elpestro_dev_theme", "elpestro_kitchen_theme"];
    for (const legacyKey of legacyKeys) {
      const legacyTheme = window.localStorage.getItem(legacyKey);
      if (isThemePreference(legacyTheme)) {
        window.localStorage.setItem(THEME_STORAGE_KEY, legacyTheme);
        return legacyTheme;
      }
    }
  } catch {
    // Read the preference already applied to the document, when available.
  }
  const applied = document.documentElement.dataset.themeMode;
  if (isThemePreference(applied)) return applied;

  // Give first-time visitors a consistent light storefront on the homepage,
  // while keeping the system default on other routes. Saved choices above win.
  return window.location.pathname === "/" ? "light" : "system";
}

function resolveTheme(preference: ThemePreference): ResolvedTheme {
  if (preference !== "system") return preference;
  return window.matchMedia("(prefers-color-scheme: dark)").matches
    ? "dark"
    : "light";
}

function applyTheme(preference: ThemePreference) {
  const root = document.documentElement;
  const resolved = resolveTheme(preference);
  root.classList.toggle("dark", resolved === "dark");
  root.dataset.themeMode = preference;
  root.style.colorScheme = resolved;
  document
    .querySelector<HTMLMetaElement>('meta[name="theme-color"]')
    ?.setAttribute("content", resolved === "dark" ? "#090d15" : "#F59E0B");
}

function subscribePreference(onChange: () => void) {
  const onThemeChange = () => onChange();
  const onStorage = (event: StorageEvent) => {
    if (event.key !== THEME_STORAGE_KEY || !isThemePreference(event.newValue)) return;
    applyTheme(event.newValue);
    window.dispatchEvent(new Event(THEME_CHANGE_EVENT));
  };
  window.addEventListener(THEME_CHANGE_EVENT, onThemeChange);
  window.addEventListener("storage", onStorage);
  return () => {
    window.removeEventListener(THEME_CHANGE_EVENT, onThemeChange);
    window.removeEventListener("storage", onStorage);
  };
}

function subscribeResolvedTheme(onChange: () => void) {
  const media = window.matchMedia("(prefers-color-scheme: dark)");
  const onSystemChange = () => {
    if (readPreference() === "system") {
      applyTheme("system");
      onChange();
    }
  };
  window.addEventListener(THEME_CHANGE_EVENT, onChange);
  media.addEventListener("change", onSystemChange);
  return () => {
    window.removeEventListener(THEME_CHANGE_EVENT, onChange);
    media.removeEventListener("change", onSystemChange);
  };
}

function getResolvedSnapshot(): ResolvedTheme {
  return document.documentElement.classList.contains("dark") ? "dark" : "light";
}

function getServerPreferenceSnapshot(): ThemePreference {
  return "system";
}

function getServerResolvedSnapshot(): ResolvedTheme {
  return "light";
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  // useSyncExternalStore keeps the server and first hydration renders aligned;
  // the layout effect applies the persisted preference before hydrated content paints.
  const preference = useSyncExternalStore(
    subscribePreference,
    readPreference,
    getServerPreferenceSnapshot
  );
  const resolvedTheme = useSyncExternalStore(
    subscribeResolvedTheme,
    getResolvedSnapshot,
    getServerResolvedSnapshot
  );

  // Apply local storage before the browser paints hydrated portal content.
  useLayoutEffect(() => {
    applyTheme(readPreference());
    window.dispatchEvent(new Event(THEME_CHANGE_EVENT));
  }, []);

  const value = useMemo<ThemeContextValue>(
    () => ({
      preference,
      resolvedTheme,
      setPreference(next) {
        try {
          window.localStorage.setItem(THEME_STORAGE_KEY, next);
        } catch {
          // Keep the choice active for this page when storage is unavailable.
        }
        applyTheme(next);
        window.dispatchEvent(new Event(THEME_CHANGE_EVENT));
      },
    }),
    [preference, resolvedTheme]
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) throw new Error("useTheme must be used inside ThemeProvider");
  return context;
}

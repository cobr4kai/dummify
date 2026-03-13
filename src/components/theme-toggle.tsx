"use client";

import { useSyncExternalStore } from "react";
import { DEFAULT_THEME, isThemeMode, THEME_STORAGE_KEY, type ThemeMode } from "@/lib/theme";
import { cn } from "@/lib/utils/cn";
import { Switch } from "@/components/ui/switch";

const THEME_CHANGE_EVENT = "abstracted-theme-change";

export function ThemeToggle({
  className,
}: {
  className?: string;
}) {
  const theme = useSyncExternalStore(subscribeToTheme, readThemePreference, () => DEFAULT_THEME);

  const isDark = theme === "dark";

  function handleCheckedChange(checked: boolean) {
    const nextTheme: ThemeMode = checked ? "dark" : "light";
    applyTheme(nextTheme);
    window.dispatchEvent(new Event(THEME_CHANGE_EVENT));

    try {
      window.localStorage.setItem(THEME_STORAGE_KEY, nextTheme);
    } catch {
      // Ignore storage failures and keep the in-memory theme.
    }
  }

  return (
    <div
      className={cn(
        "inline-flex shrink-0 items-center gap-2 text-[11px] font-medium uppercase tracking-[0.18em] text-muted-foreground",
        className,
      )}
    >
      <span className={cn("transition-colors", !isDark && "text-foreground")}>Light</span>
      <Switch
        aria-label={isDark ? "Switch to light mode" : "Switch to dark mode"}
        checked={isDark}
        onCheckedChange={handleCheckedChange}
      />
      <span className={cn("transition-colors", isDark && "text-foreground")}>Dark</span>
    </div>
  );
}

function applyTheme(theme: ThemeMode) {
  document.documentElement.setAttribute("data-theme", theme);
  document.documentElement.style.colorScheme = theme;
}

function readThemePreference(): ThemeMode {
  const currentTheme = document.documentElement.getAttribute("data-theme");
  if (isThemeMode(currentTheme)) {
    return currentTheme;
  }

  try {
    const storedTheme = window.localStorage.getItem(THEME_STORAGE_KEY);
    if (isThemeMode(storedTheme)) {
      return storedTheme;
    }
  } catch {
    // Ignore storage failures and fall back to the active document theme.
  }

  return DEFAULT_THEME;
}

function subscribeToTheme(onStoreChange: () => void) {
  const handleStorage = (event: StorageEvent) => {
    if (event.key && event.key !== THEME_STORAGE_KEY) {
      return;
    }

    onStoreChange();
  };

  window.addEventListener("storage", handleStorage);
  window.addEventListener(THEME_CHANGE_EVENT, onStoreChange);

  return () => {
    window.removeEventListener("storage", handleStorage);
    window.removeEventListener(THEME_CHANGE_EVENT, onStoreChange);
  };
}

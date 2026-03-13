"use client";

import { MoonStar, SunMedium } from "lucide-react";
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
        "panel-soft inline-flex shrink-0 items-center gap-2 rounded-full px-2.5 py-1.5 text-muted-foreground",
        className,
      )}
    >
      <SunMedium className={cn("h-3.5 w-3.5", !isDark && "text-foreground")} />
      <Switch
        aria-label={isDark ? "Switch to light mode" : "Switch to dark mode"}
        checked={isDark}
        onCheckedChange={handleCheckedChange}
      />
      <MoonStar className={cn("h-3.5 w-3.5", isDark && "text-foreground")} />
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

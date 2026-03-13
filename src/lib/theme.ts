export type ThemeMode = "light" | "dark";

export const THEME_STORAGE_KEY = "abstracted-theme";
export const DEFAULT_THEME: ThemeMode = "dark";

export function isThemeMode(value: string | null): value is ThemeMode {
  return value === "light" || value === "dark";
}

export const themeInitScript = `(() => {
  const storageKey = ${JSON.stringify(THEME_STORAGE_KEY)};
  const defaultTheme = ${JSON.stringify(DEFAULT_THEME)};

  try {
    const storedTheme = window.localStorage.getItem(storageKey);
    const theme = storedTheme === "light" || storedTheme === "dark"
      ? storedTheme
      : defaultTheme;

    document.documentElement.setAttribute("data-theme", theme);
    document.documentElement.style.colorScheme = theme;
  } catch {
    document.documentElement.setAttribute("data-theme", defaultTheme);
    document.documentElement.style.colorScheme = defaultTheme;
  }
})();`;

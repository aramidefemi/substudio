/**
 * Theme registry. Adding a theme = one CSS file in `src/styles/themes/`
 * (imported from `src/index.css`) plus one entry here. See the `add-theme` skill.
 */
export const THEMES = [
  { id: "light", label: "Light", scheme: "light" },
  { id: "dark", label: "Dark", scheme: "dark" },
] as const;

export type Theme = (typeof THEMES)[number];
export type ThemeId = Theme["id"];
export type ThemePreference = ThemeId | "system";

const prefersDark = () => window.matchMedia("(prefers-color-scheme: dark)").matches;

export function resolveTheme(pref: ThemePreference): Theme {
  const id: ThemeId = pref === "system" ? (prefersDark() ? "dark" : "light") : pref;
  return THEMES.find((t) => t.id === id) ?? THEMES[0];
}

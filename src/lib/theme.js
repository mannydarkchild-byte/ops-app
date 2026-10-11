export const THEME_KEY = "ops-theme";

/** Phone chrome stays dark in both themes so clock and signal stay visible. */
const STATUS_BAR_COLOR = "#0A0A0A";

export function readTheme() {
  try {
    return localStorage.getItem(THEME_KEY) === "light" ? "light" : "dark";
  } catch {
    return "dark";
  }
}

export function applyTheme(theme) {
  const next = theme === "light" ? "light" : "dark";
  document.documentElement.dataset.theme = next;
  document.documentElement.classList.toggle("theme-light", next === "light");
  document.documentElement.style.colorScheme = next;

  const colorScheme = document.querySelector('meta[name="color-scheme"]');
  if (colorScheme) colorScheme.setAttribute("content", next);

  document.querySelectorAll('meta[name="theme-color"]').forEach((meta) => {
    meta.setAttribute("content", STATUS_BAR_COLOR);
  });

  const apple = document.querySelector('meta[name="apple-mobile-web-app-status-bar-style"]');
  if (apple) apple.setAttribute("content", "black");
}

export function persistTheme(theme) {
  const next = theme === "light" ? "light" : "dark";
  try {
    localStorage.setItem(THEME_KEY, next);
  } catch {}
  applyTheme(next);
  return next;
}

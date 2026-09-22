// Global theme switching.
//
// The look of the entire app (light / dark / midnight) is decided by the admin
// from the admin page and persisted server-side as a single ThemeConfig. Every
// visitor's page fetches /api/theme on load and applies it, so the admin's
// choice is reflected everywhere. Browsers also cache the last theme under
// `po_theme` so a returning user sees the right colors before the server reply
// arrives — the server stays the source of truth.
import { API_BASE } from './applications';

export type ThemeId = 'light' | 'dark' | 'midnight';

export const THEME_STORAGE_KEY = 'po_theme';

export const THEME_IDS: ThemeId[] = ['light', 'dark', 'midnight'];

export const THEME_META: Record<
  ThemeId,
  { label: string; description: string; swatchBg: string; swatchAccent: string }
> = {
  light: {
    label: 'Light',
    description: 'Bright, high-contrast light theme',
    swatchBg: '#f2f4f0',
    swatchAccent: '#4c7a12',
  },
  dark: {
    label: 'Dark',
    description: 'The classic deep green-black theme',
    swatchBg: '#070e0a',
    swatchAccent: '#84cc16',
  },
  midnight: {
    label: 'Midnight',
    description: 'Pure black screen — no green blend',
    swatchBg: '#000000',
    swatchAccent: '#84cc16',
  },
};

// Color of the browser UI (address bar) per theme — matches the page bg, so
// overscroll never shows a mismatched band.
const THEME_COLORS: Record<ThemeId, string> = {
  light: '#f2f4f0',
  dark: '#0a0f16',
  midnight: '#000000',
};

export const isThemeId = (value: unknown): value is ThemeId =>
  value === 'light' || value === 'dark' || value === 'midnight';

export const readStoredTheme = (): ThemeId => {
  try {
    const stored = localStorage.getItem(THEME_STORAGE_KEY);
    return isThemeId(stored) ? stored : 'dark';
  } catch {
    return 'dark';
  }
};

export const storeTheme = (id: ThemeId): void => {
  try {
    localStorage.setItem(THEME_STORAGE_KEY, id);
  } catch {
    // Storage blocked — ignore, the server value still applies on next load.
  }
};

// Applies the theme to <html> so every [data-theme]-scoped var reacts instantly.
export const applyTheme = (id: ThemeId): void => {
  document.documentElement.dataset.theme = id;
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute('content', THEME_COLORS[id]);
};

// Fetch the global theme the admin chose. Returns the server value or null if
// the request failed (caller falls back to its local cache / dark default).
export async function fetchServerTheme(signal?: AbortSignal): Promise<ThemeId | null> {
  try {
    const res = await fetch(`${API_BASE}/theme`, {
      signal,
      headers: { 'Cache-Control': 'no-cache' },
    });
    if (!res.ok) return null;
    const data = await res.json();
    return isThemeId(data.theme) ? data.theme : null;
  } catch {
    return null;
  }
}
// Global theme switching.
//
// Two layers:
//   - PLATFORM theme: decided by the admin on the admin page and persisted
//     server-side as a single ThemeConfig. It is the default every visitor sees.
//   - PERSONAL theme: any user can pick their own light / dark / midnight from
//     the user menu (Navbar), stored in their browser. A personal pick always
//     wins over the platform default for that user's pages until they switch
//     back to "Follow platform theme".
import { API_BASE } from './applications';

export type ThemeId = 'light' | 'dark' | 'midnight';
export type ThemePreference = ThemeId | 'platform';

// Key of the LAST APPLIED theme — cached only to avoid a flash before the
// server reply lands (written on every applied change).
export const THEME_STORAGE_KEY = 'po_theme';

// Key of the user's explicit PERSONAL choice ('platform' = follow the admin's
// global theme). Not written unless the user actually picks something on the
// Navbar, so brand-new visitors always follow the platform theme.
export const THEME_PREF_STORAGE_KEY = 'po_theme_pref';

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

export const readStoredPreference = (): ThemePreference => {
  try {
    const stored = localStorage.getItem(THEME_PREF_STORAGE_KEY);
    return isThemeId(stored) ? stored : 'platform';
  } catch {
    return 'platform';
  }
};

export const storePreference = (pref: ThemePreference): void => {
  try {
    localStorage.setItem(THEME_PREF_STORAGE_KEY, pref);
  } catch {
    // Storage blocked — ignore, the platform theme still applies.
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
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { API_BASE } from '../lib/applications';
import { apiFetch } from '../lib/api';
import {
  applyTheme,
  fetchServerTheme,
  readStoredPreference,
  readStoredTheme,
  storePreference,
  storeTheme,
  type ThemeId,
  type ThemePreference,
} from '../lib/theme';

interface ThemeContextValue {
  // The theme currently applied to this browser (personal pick wins over the
  // platform default).
  theme: ThemeId;
  // The global theme the admin chose for the platform (what "Follow platform
  // theme" resolves to). Starts from the local cache, then syncs from the server.
  platformTheme: ThemeId;
  // 'platform' to follow the admin's global theme, or a ThemeId for a personal pick.
  preference: ThemePreference;
  // Whether the server's platform theme has been resolved for this session yet.
  ready: boolean;
  // Set THIS browser's personal theme ('platform' = follow the admin's pick).
  setPreference: (pref: ThemePreference) => void;
  // Switch the GLOBAL theme (admin only) — persists to the server, which then
  // pushes the change to every platform-following user's page on their next load.
  // Also adopts that theme as this browser's personal pick.
  setTheme: (id: ThemeId) => Promise<boolean>;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

export function ThemeProvider({ children }: { children: ReactNode }) {
  const initialPreference = useMemo(() => readStoredPreference(), []);
  const [preference, setPreferenceState] = useState<ThemePreference>(initialPreference);
  const [platformTheme, setPlatformTheme] = useState<ThemeId>(readStoredTheme);
  const [ready, setReady] = useState(false);

  // What actually hits <html> — the user's pick when set, otherwise the
  // platform theme (local cache → server value once it resolves).
  const theme: ThemeId = preference === 'platform' ? platformTheme : preference;

  useEffect(() => {
    // Re-apply on every change and keep the flash-guard cache in sync so the
    // pre-paint script in index.html shows the same colors on next load.
    applyTheme(theme);
    storeTheme(theme);
  }, [theme, preference]);

  useEffect(() => {
    let cancelled = false;
    const controller = new AbortController();
    (async () => {
      const serverTheme = await fetchServerTheme(controller.signal);
      if (cancelled) return;
      if (serverTheme) setPlatformTheme(serverTheme);
    })().finally(() => {
      if (!cancelled) setReady(true);
    });
    return () => {
      cancelled = true;
      controller.abort();
    };
  }, []);

  const setPreference = useCallback((pref: ThemePreference) => {
    setPreferenceState(pref);
    storePreference(pref);
  }, []);

  const setTheme = useCallback(
    async (id: ThemeId): Promise<boolean> => {
      // The admin's Appearance section owns the GLOBAL theme: it is separate
      // from the user's personal Navbar pick, so we never touch `preference`
      // here. The admin's own screen still follows it unless they overrode it.
      setPlatformTheme(id);
      try {
        const res = await apiFetch(`${API_BASE}/admin/theme`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ theme: id }),
        });
        const data = await res.json().catch(() => ({}));
        return Boolean(data?.success);
      } catch {
        return false;
      }
    },
    []
  );

  const value = useMemo(
    () => ({ theme, platformTheme, preference, ready, setPreference, setTheme }),
    [theme, platformTheme, preference, ready, setPreference, setTheme]
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme must be used within ThemeProvider');
  return ctx;
}
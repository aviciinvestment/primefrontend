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
  readStoredTheme,
  storeTheme,
  type ThemeId,
} from '../lib/theme';

interface ThemeContextValue {
  theme: ThemeId;
  // Whether the server's theme has been resolved for this session yet.
  ready: boolean;
  // Reset this browser's theme locally (no server call).
  setLocalTheme: (id: ThemeId) => void;
  // Switch the GLOBAL theme (admin only) — persists to the server, which then
  // pushes the change to every other user's page on their next load.
  setTheme: (id: ThemeId) => Promise<boolean>;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<ThemeId>(() => {
    const initial = readStoredTheme();
    applyTheme(initial);
    return initial;
  });
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const controller = new AbortController();
    (async () => {
      const serverTheme = await fetchServerTheme(controller.signal);
      if (cancelled) return;
      if (serverTheme) {
        setThemeState(serverTheme);
        applyTheme(serverTheme);
        storeTheme(serverTheme);
      }
    })().finally(() => {
      if (!cancelled) setReady(true);
    });
    return () => {
      cancelled = true;
      controller.abort();
    };
  }, []);

  const setLocalTheme = useCallback((id: ThemeId) => {
    setThemeState(id);
    applyTheme(id);
    storeTheme(id);
  }, []);

  const setTheme = useCallback(
    async (id: ThemeId): Promise<boolean> => {
      setLocalTheme(id);
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
    [setLocalTheme]
  );

  const value = useMemo(
    () => ({ theme, ready, setLocalTheme, setTheme }),
    [theme, ready, setLocalTheme, setTheme]
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme must be used within ThemeProvider');
  return ctx;
}
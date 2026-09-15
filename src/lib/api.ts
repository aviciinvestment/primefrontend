// Central token plumbing: the AuthContext registers a getter that resolves the
// current Firebase ID token, and every API call goes through apiFetch so the
// Authorization header is attached automatically (per the server's C2/C3 fix).

import { auth } from './firebase';

type TokenGetter = () => Promise<string | null>;

let tokenGetter: TokenGetter | null = null;

export const setAuthTokenGetter = (getter: TokenGetter | null): void => {
  tokenGetter = getter;
};

// Resolve a current ID token. Prefers the registered getter, but falls back
// to the live Firebase session so calls made before the getter-effect runs
// (e.g. the auth-sync + dashboard fetches on first render) still authenticate.
export const getAuthToken = async (): Promise<string | null> => {
  if (tokenGetter) return tokenGetter();
  if (auth.currentUser) {
    try {
      return await auth.currentUser.getIdToken(false);
    } catch {
      return null;
    }
  }
  return null;
};

// Wrapper that injects `Authorization: Bearer <idToken>` when signed in.
export const apiFetch = async (url: string, init: RequestInit = {}): Promise<Response> => {
  const headers = new Headers(init.headers || {});
  const token = await getAuthToken();
  if (token) headers.set('Authorization', `Bearer ${token}`);
  return fetch(url, { ...init, headers });
};

// POSTs JSON with auth + JSON headers and parses the JSON body (throws on
// non-2xx so callers get a clear error).
export const apiJson = async <T = any>(url: string, body: unknown): Promise<T> => {
  const res = await apiFetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error((data as any)?.error || (data as any)?.message || 'Request failed.');
  }
  return data as T;
};
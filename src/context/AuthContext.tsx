import { createContext, useContext, useEffect, useMemo, useState, useCallback, type ReactNode } from 'react';
import type { User } from 'firebase/auth';
import { getFirebase } from '../lib/firebase';
import { API_BASE } from '../lib/applications';
import { apiFetch, setAuthTokenGetter } from '../lib/api';

// Lazy loader for the Firebase Auth SDK. Every handler below resolves the SDK
// through here, so the auth chunk is fetched/parsed only when a real auth
// action happens (sign-in click, session restore on boot) — never on first
// paint for casual visitors. The import() result is cached by the bundler.
const loadAuthApi = async () => {
  const firebaseAuth = await import('firebase/auth');
  const { auth } = await getFirebase();
  return { ...firebaseAuth, auth };
};

interface AuthContextValue {
  user: User | null;
  role: string | null;
  isAdmin: boolean;
  loading: boolean;
  roleReady: boolean;
  logInWithEmail: (email: string, password: string) => Promise<void>;
  registerWithEmail: (email: string, password: string, displayName: string) => Promise<void>;
  resendVerificationEmail: () => Promise<void>;
  reloadUser: () => Promise<void>;
  logInWithGoogle: () => Promise<void>;
  logout: () => Promise<void>;
  updatePhoto: (photoURL: string) => Promise<void>;
  refreshRole: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [role, setRole] = useState<string | null>(null);
  // True once the server has resolved this user's role (even if it failed),
  // so gates can safely distinguish a real non-admin from a resolution race.
  const [roleReady, setRoleReady] = useState(true);

  // Keep the server / apiFetch's token getter in sync with the session. The
  // Firebase SDK refreshes ID tokens automatically, so getIdToken() always
  // returns a fresh, valid token while signed in.
  useEffect(() => {
    setAuthTokenGetter(user ? () => user.getIdToken(false) : null);
    return () => setAuthTokenGetter(null);
  }, [user]);

  const syncAppUser = useCallback(async (currentUser: User) => {
    try {
      const res = await apiFetch(`${API_BASE}/users`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: currentUser.email || '',
          displayName: currentUser.displayName || '',
          photoURL: currentUser.photoURL || '',
        }),
      });
      const data = await res.json();
      if (data.success && data.user) setRole(data.user.role || 'user');
    } catch (err) {
      console.error('Failed to sync app user:', err);
    } finally {
      setRoleReady(true);
    }
  }, []);

  // Session restore: attach the auth listener as soon as Firebase is ready.
  // This runs in an effect (after first paint) and through the lazy loader,
  // so the auth engine never blocks the initial render. Sign-in is restored
  // for returning users; anonymous visitors just see the shell immediately.
  useEffect(() => {
    let cancelled = false;
    let unsubscribe: (() => void) | undefined;

    const startAuth = async () => {
      try {
        const { auth, onAuthStateChanged } = await loadAuthApi();
        if (cancelled) return;
        unsubscribe = onAuthStateChanged(auth, (currentUser) => {
          setUser(currentUser);
          setRole(currentUser ? 'user' : null);
          setRoleReady(!currentUser);
          if (currentUser) syncAppUser(currentUser);
          setLoading(false);
        });
      } catch (err) {
        console.error('Auth initialization failed:', err);
        if (!cancelled) setLoading(false);
      }
    };

    startAuth();
    return () => {
      cancelled = true;
      unsubscribe?.();
    };
  }, [syncAppUser]);

  const refreshRole = useCallback(async () => {
    if (user) await syncAppUser(user);
  }, [user, syncAppUser]);

  const logInWithEmail = useCallback(async (email: string, password: string) => {
    const { auth, signInWithEmailAndPassword } = await loadAuthApi();
    await signInWithEmailAndPassword(auth, email, password);
  }, []);

  const registerWithEmail = useCallback(async (email: string, password: string, displayName: string) => {
    const { auth, createUserWithEmailAndPassword, updateProfile, sendEmailVerification } = await loadAuthApi();
    const credential = await createUserWithEmailAndPassword(auth, email, password);
    if (displayName.trim()) {
      await updateProfile(credential.user, { displayName: displayName.trim() });
    }
    // Soft email verification: send the email but never block app usage.
    sendEmailVerification(credential.user).catch(() => {
      /* verification email is best-effort */
    });
  }, []);

  const logInWithGoogle = useCallback(async () => {
    const { auth, signInWithPopup, GoogleAuthProvider } = await loadAuthApi();
    const provider = new GoogleAuthProvider();
    await signInWithPopup(auth, provider);
  }, []);

  const resendVerificationEmail = useCallback(async () => {
    const { auth, sendEmailVerification } = await loadAuthApi();
    if (!auth.currentUser) throw new Error('No user is signed in.');
    await sendEmailVerification(auth.currentUser);
  }, []);

  // Refresh the Firebase user in place (e.g. after clicking the verification
  // link, so `emailVerified` flips to true without a full page reload).
  const reloadUser = useCallback(async () => {
    const { auth } = await loadAuthApi();
    if (auth.currentUser) {
      await auth.currentUser.reload();
      setUser({ ...auth.currentUser });
    }
  }, []);

  const logout = useCallback(async () => {
    const { auth, signOut } = await loadAuthApi();
    await signOut(auth);
  }, []);

  const updatePhoto = useCallback(async (photoURL: string) => {
    const { auth, updateProfile } = await loadAuthApi();
    if (auth.currentUser) {
      await updateProfile(auth.currentUser, { photoURL });
      setUser({ ...auth.currentUser });
    }
  }, []);

  const authValue = useMemo(() => ({
    user,
    role,
    isAdmin: role === 'admin',
    loading,
    roleReady,
    logInWithEmail,
    registerWithEmail,
    resendVerificationEmail,
    reloadUser,
    logInWithGoogle,
    logout,
    updatePhoto,
    refreshRole,
  }), [user, role, loading, roleReady, logInWithEmail, registerWithEmail, resendVerificationEmail, reloadUser, logInWithGoogle, logout, updatePhoto, refreshRole]);

  return (
    <AuthContext.Provider value={authValue}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
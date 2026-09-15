import { createContext, useContext, useEffect, useMemo, useState, useCallback, type ReactNode } from 'react';
import {
  onAuthStateChanged,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signInWithPopup,
  GoogleAuthProvider,
  signOut,
  updateProfile,
  sendEmailVerification,
  type User,
} from 'firebase/auth';
import { auth } from '../lib/firebase';
import { API_BASE } from '../lib/applications';
import { apiFetch, setAuthTokenGetter } from '../lib/api';

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

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setRole(currentUser ? 'user' : null);
      setRoleReady(!currentUser);
      if (currentUser) syncAppUser(currentUser);
      setLoading(false);
    });
    return unsubscribe;
  }, [syncAppUser]);

  const refreshRole = async () => {
    if (user) await syncAppUser(user);
  };

  const logInWithEmail = async (email: string, password: string) => {
    await signInWithEmailAndPassword(auth, email, password);
  };

  const registerWithEmail = async (email: string, password: string, displayName: string) => {
    const credential = await createUserWithEmailAndPassword(auth, email, password);
    if (displayName.trim()) {
      await updateProfile(credential.user, { displayName: displayName.trim() });
    }
    // Soft email verification: send the email but never block app usage.
    sendEmailVerification(credential.user).catch(() => {
      /* verification email is best-effort */
    });
  };

  const logInWithGoogle = async () => {
    const provider = new GoogleAuthProvider();
    await signInWithPopup(auth, provider);
  };

  const resendVerificationEmail = async () => {
    if (!auth.currentUser) throw new Error('No user is signed in.');
    await sendEmailVerification(auth.currentUser);
  };

  // Refresh the Firebase user in place (e.g. after clicking the verification
  // link, so `emailVerified` flips to true without a full page reload).
  const reloadUser = async () => {
    if (auth.currentUser) {
      await auth.currentUser.reload();
      setUser({ ...auth.currentUser });
    }
  };

  const logout = async () => {
    await signOut(auth);
  };

  const updatePhoto = async (photoURL: string) => {
    if (auth.currentUser) {
      await updateProfile(auth.currentUser, { photoURL });
      setUser({ ...auth.currentUser });
    }
  };

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
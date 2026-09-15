import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import {
  onAuthStateChanged,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signInWithPopup,
  GoogleAuthProvider,
  signOut,
  updateProfile,
  type User,
} from 'firebase/auth';
import { auth } from '../lib/firebase';
import { API_BASE } from '../lib/applications';

interface AuthContextValue {
  user: User | null;
  role: string | null;
  isAdmin: boolean;
  loading: boolean;
  logInWithEmail: (email: string, password: string) => Promise<void>;
  registerWithEmail: (email: string, password: string, displayName: string) => Promise<void>;
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

  // Register/refresh the Firebase identity on the server so it appears in the
  // admin user list and picks up privileges (promoted admin / approved mentor).
  const syncAppUser = async (currentUser: User) => {
    try {
      const res = await fetch(`${API_BASE}/users`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          uid: currentUser.uid,
          email: currentUser.email || '',
          displayName: currentUser.displayName || '',
          photoURL: currentUser.photoURL || '',
        }),
      });
      const data = await res.json();
      if (data.success && data.user) setRole(data.user.role || 'user');
    } catch (err) {
      console.error('Failed to sync app user:', err);
    }
  };

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setRole(currentUser ? 'user' : null);
      if (currentUser) syncAppUser(currentUser);
      setLoading(false);
    });
    return unsubscribe;
  }, []);

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
  };

  const logInWithGoogle = async () => {
    const provider = new GoogleAuthProvider();
    await signInWithPopup(auth, provider);
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

  return (
    <AuthContext.Provider value={{ user, role, isAdmin: role === 'admin', loading, logInWithEmail, registerWithEmail, logInWithGoogle, logout, updatePhoto, refreshRole }}>
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
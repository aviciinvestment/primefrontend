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

interface AuthContextValue {
  user: User | null;
  loading: boolean;
  logInWithEmail: (email: string, password: string) => Promise<void>;
  registerWithEmail: (email: string, password: string, displayName: string) => Promise<void>;
  logInWithGoogle: () => Promise<void>;
  logout: () => Promise<void>;
  updatePhoto: (photoURL: string) => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setLoading(false);
    });
    return unsubscribe;
  }, []);

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
    <AuthContext.Provider value={{ user, loading, logInWithEmail, registerWithEmail, logInWithGoogle, logout, updatePhoto }}>
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
import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getAnalytics, type Analytics } from 'firebase/analytics';

const firebaseConfig = {
  apiKey: 'AIzaSyD-I7MAdP-RHUjzsovN6_JAxRo75RTaKEU',
  authDomain: 'primeopportunity-18381.firebaseapp.com',
  projectId: 'primeopportunity-18381',
  storageBucket: 'primeopportunity-18381.firebasestorage.app',
  messagingSenderId: '309913954955',
  appId: '1:309913954955:web:23f64afb0596e4083f028e',
  measurementId: 'G-QDEX54H5SQ',
};

const app = initializeApp(firebaseConfig);

let analytics: Analytics | null = null;
try {
  analytics = getAnalytics(app);
} catch {
  // Analytics is optional; skip if unavailable (e.g. SSR/build context)
}

export { app, analytics };
export const auth = getAuth(app);
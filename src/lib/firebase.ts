import type { FirebaseApp } from 'firebase/app';
import type { Auth } from 'firebase/auth';
import type { Analytics } from 'firebase/analytics';

const firebaseConfig = {
  apiKey: 'AIzaSyD-I7MAdP-RHUjzsovN6_JAxRo75RTaKEU',
  authDomain: 'primeopportunity-18381.firebaseapp.com',
  projectId: 'primeopportunity-18381',
  storageBucket: 'primeopportunity-18381.firebasestorage.app',
  messagingSenderId: '309913954955',
  appId: '1:309913954955:web:23f64afb0596e4083f028e',
  measurementId: 'G-QDEX54H5SQ',
};

// ---------------------------------------------------------------------------
// Lazy Firebase bootstrapping.
//
// Nothing here runs at import time. The SDK is fetched, parsed and initialized
// only when something actually needs it (a sign-in click, a gated route, the
// session-restore effect). Casual landing page / waitlist visitors who never
// sign in therefore never download or execute the auth/analytics engine — it
// stays out of the initial bundle graph entirely. The dynamic-imported chunk is
// cached by the bundler after the first fetch.
// ---------------------------------------------------------------------------

export interface FirebaseBundle {
  app: FirebaseApp;
  auth: Auth;
  analytics: Analytics | null;
}

let firebasePromise: Promise<FirebaseBundle> | null = null;

// Memoized loader: identical callers share one in-flight promise, so repeated
// requests never re-import or re-initialize Firebase.
export function getFirebase(): Promise<FirebaseBundle> {
  if (!firebasePromise) {
    firebasePromise = (async () => {
      const [{ initializeApp }, { getAuth }, { getAnalytics }] = await Promise.all([
        import('firebase/app'),
        import('firebase/auth'),
        import('firebase/analytics'),
      ]);
      const app = initializeApp(firebaseConfig);
      let analytics: Analytics | null = null;
      try {
        analytics = getAnalytics(app);
      } catch {
        // Analytics is optional — skip when unavailable (SSR / build / blocked).
      }
      return { app, auth: getAuth(app), analytics };
    })();
  }
  return firebasePromise;
}

// Fire-and-forget prefetch: fetch the Firebase chunk on the first real user
// intent (tap / keypress) so any later auth interaction is instant. Self-cleaning
// — the listeners detach after the first wake, so they never accumulate.
const WAKE_EVENTS = ['pointerdown', 'keydown', 'touchstart'] as const;
let wakeBound = false;

export function wakeFirebase(): void {
  if (wakeBound) return;
  wakeBound = true;
  const wake = () => {
    getFirebase().catch(() => {});
    for (const ev of WAKE_EVENTS) window.removeEventListener(ev, wake, true);
  };
  for (const ev of WAKE_EVENTS) window.addEventListener(ev, wake, true);
}

// Convenience accessors used by api.ts / AuthContext.tsx / pages.
export const getAuthInstance = async (): Promise<Auth> => (await getFirebase()).auth;
export const getAnalyticsInstance = async (): Promise<Analytics | null> => (await getFirebase()).analytics;
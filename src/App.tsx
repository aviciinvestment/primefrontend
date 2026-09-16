import { Suspense, lazy } from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import Navbar from './components/layout/Navbar';
import Footer from './components/layout/Footer';
import ChatWidget from './components/ChatWidget';
import EmailVerificationScreen from './components/EmailVerificationScreen';
import ProtectedRoute from './components/ProtectedRoute';
import { AuthProvider, useAuth } from './context/AuthContext';
import Dashboard from './pages/Dashboard';

// Route-level code splitting: heavy admin/mentor pages load lazily.
const Applications = lazy(() => import('./pages/Applications'));
const Profile = lazy(() => import('./pages/Profile'));
const Login = lazy(() => import('./pages/Login'));
const Register = lazy(() => import('./pages/Register'));
const MentorshipGuidance = lazy(() => import('./pages/MentorshipGuidance'));
const MentorshipInterest = lazy(() => import('./pages/MentorshipInterest'));
const MentorPage = lazy(() => import('./pages/MentorPage'));
const AdminPage = lazy(() => import('./pages/AdminPage'));

const PageLoader = () => (
  <div className="flex items-center justify-center py-28" role="status" aria-label="Loading page">
    <div className="relative h-10 w-10">
      <div className="absolute inset-0 animate-spin rounded-full border-2 border-[#84cc16]/20 border-t-[#84cc16]" />
      <div className="absolute inset-2.5 rounded-full border border-[#84cc16]/30 animate-pulse" />
    </div>
  </div>
);

// Verification gate: admins pass through (they are server-promoted and need to
// preview/build the app while unverified); everyone else must verify their
// email before app screens render. The shell renders IMMEDIATELY — auth simply
// upgrades the UI when ready — and the gate only swaps in once we know the
// user is a non-admin, so no full-page spinner ever blanks the site.
function AuthGate({ children }: { children: React.ReactNode }) {
  const { user, isAdmin, roleReady } = useAuth();
  if (user && !user.emailVerified && !isAdmin && roleReady) {
    return <EmailVerificationScreen />;
  }
  return <>{children}</>;
}

function App() {
  return (
    <Router>
      <AuthProvider>
        <AuthGate>
        <div className="relative min-h-screen overflow-x-clip bg-[#070e0a] font-sans antialiased text-white selection:bg-[#84cc16]/30">
          {/* Subtle Ambient Green Glow — static gradient, compositor-cheap */}
          <div className="pointer-events-none absolute inset-0 z-0 bg-[radial-gradient(ellipse_at_top,_rgba(132,204,22,0.10),_transparent_60%)]"></div>

          {/* Global Grid Line Pattern - Faint Green */}
          <div
            className="pointer-events-none absolute inset-0 z-0"
            style={{
              backgroundImage: `
                linear-gradient(to right, rgba(132, 204, 34, 0.04) 1px, transparent 1px),
                linear-gradient(to bottom, rgba(132, 204, 34, 0.04) 1px, transparent 1px)
              `,
              backgroundSize: '60px 60px',
            }}
          ></div>

          <div className="relative z-10 mx-auto flex min-h-screen w-full max-w-[1440px] flex-col">
            <Navbar />
            <main className="section-shell flex-1 pt-8 pb-16 md:pt-10 md:pb-20">
              <Suspense fallback={<PageLoader />}>
                <Routes>
                  <Route path="/" element={<Dashboard />} />
                  <Route path="/login" element={<Login />} />
                  <Route path="/register" element={<Register />} />
                  <Route path="/applications" element={<ProtectedRoute><Applications /></ProtectedRoute>} />
                  <Route path="/profile" element={<ProtectedRoute><Profile /></ProtectedRoute>} />
                  <Route path="/mentorship" element={<ProtectedRoute><MentorshipGuidance /></ProtectedRoute>} />
                  <Route path="/mentorship/interest" element={<ProtectedRoute><MentorshipInterest /></ProtectedRoute>} />
                  <Route path="/mentors" element={<ProtectedRoute><MentorPage /></ProtectedRoute>} />
                  <Route path="/admin" element={<ProtectedRoute><AdminPage /></ProtectedRoute>} />
                </Routes>
              </Suspense>
            </main>
            <Footer />
            <ChatWidget />
          </div>
        </div>
        </AuthGate>
      </AuthProvider>
    </Router>
  );
}

export default App;

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
  <div className="flex items-center justify-center py-24">
    <div className="h-8 w-8 animate-spin rounded-full border-2 border-[#84cc16] border-t-transparent" />
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
        <div className="min-h-screen bg-[#070e0a] font-sans antialiased text-white relative">
          {/* Subtle Ambient Green Glow */}
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-primary/10 via-[#070e0a]/50 to-[#070e0a] pointer-events-none z-0"></div>

          {/* Global Grid Line Pattern - Faint Green */}
          <div 
            className="absolute inset-0 pointer-events-none z-0"
            style={{
              backgroundImage: `
                linear-gradient(to right, rgba(132, 204, 34, 0.05) 1px, transparent 1px),
                linear-gradient(to bottom, rgba(132, 204, 34, 0.05) 1px, transparent 1px)
              `,
              backgroundSize: '60px 60px'
            }}
          ></div>

          <div className="relative z-10 max-w-[1440px] mx-auto flex flex-col">
            <Navbar />
            <main className="container mx-auto py-6 px-4 md:px-8">
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

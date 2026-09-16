import { useState, type FormEvent } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Radar, LogIn, Mail, Lock, Loader2 } from 'lucide-react';
import GoogleIcon from '../components/GoogleIcon';

export default function Login() {
  const { logInWithEmail, logInWithGoogle } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const from = (location.state as { from?: string } | null)?.from || '/';

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    setSubmitting(true);
    try {
      await logInWithEmail(email, password);
      navigate(from, { replace: true });
    } catch (err: any) {
      setError(normalizeAuthError(err));
    } finally {
      setSubmitting(false);
    }
  };

  const handleGoogle = async () => {
    setError('');
    setSubmitting(true);
    try {
      await logInWithGoogle();
      navigate(from, { replace: true });
    } catch (err: any) {
      setError(normalizeAuthError(err));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="flex justify-center px-4 py-10 md:py-16">
      <div className="w-full max-w-md">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="mb-4 inline-flex rounded-2xl bg-[#84cc16] p-3 text-[#070e0a] shadow-[0_8px_24px_-10px_rgba(132,204,22,0.8)] ring-1 ring-[#84cc16]/30">
            <Radar className="h-8 w-8" />
          </div>
          <span className="eyebrow mb-3">Member Access</span>
          <h1 className="text-2xl font-extrabold leading-tight tracking-tight text-white sm:text-3xl">Welcome back</h1>
          <p className="mt-2 text-sm leading-relaxed text-gray-400 sm:text-base">Log in to continue your opportunity journey</p>
        </div>

        <div className="card-surface p-6 sm:p-8">
          {/* Google Button */}
          <button
            onClick={handleGoogle}
            disabled={submitting}
            className="focus-ring flex h-11 w-full items-center justify-center gap-3 rounded-xl bg-white font-bold text-[#1f2937] transition-colors hover:bg-gray-100 active:scale-[0.97] disabled:opacity-50"
          >
            <GoogleIcon className="h-5 w-5" />
            Continue with Google
          </button>

          {/* Divider */}
          <div className="flex items-center gap-4 my-6">
            <div className="flex-1 h-px bg-white/10"></div>
            <span className="text-xs text-gray-500 uppercase tracking-wider">or</span>
            <div className="flex-1 h-px bg-white/10"></div>
          </div>

          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1.5">
                <Mail className="inline h-4 w-4 mr-1 text-[#84cc16]" /> Email
              </label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                className="input-base"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1.5">
                <Lock className="inline h-4 w-4 mr-1 text-[#84cc16]" /> Password
              </label>
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="input-base"
              />
            </div>

            {error && (
              <div className="rounded-xl bg-red-500/10 border border-red-500/30 text-red-300 text-sm px-4 py-3">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={submitting}
              className="btn-primary h-12 w-full"
            >
              {submitting ? <Loader2 className="h-5 w-5 animate-spin" /> : <LogIn className="h-5 w-5" />}
              Log In
            </button>
          </form>

          <p className="text-center text-sm text-gray-400 mt-6">
            Don't have an account?{' '}
            <Link to="/register" className="focus-ring rounded font-semibold text-[#84cc16] hover:text-[#a3e635] hover:underline">
              Sign up
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}

function normalizeAuthError(err: any): string {
  const code: string = err?.code || '';
  switch (code) {
    case 'auth/user-not-found':
    case 'auth/wrong-password':
    case 'auth/invalid-credential':
      return 'Invalid email or password.';
    case 'auth/invalid-email':
      return 'Please enter a valid email address.';
    case 'auth/too-many-requests':
      return 'Too many attempts. Please try again later.';
    case 'auth/user-disabled':
      return 'This account has been disabled.';
    case 'auth/popup-closed-by-user':
      return 'Google sign-in was cancelled.';
    default:
      return err?.message || 'An unexpected error occurred.';
  }
}
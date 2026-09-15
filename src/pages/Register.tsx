import { useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Radar, UserPlus, Mail, Lock, User, Loader2 } from 'lucide-react';
import GoogleIcon from '../components/GoogleIcon';

function validatePassword(pw: string): string | null {
  if (pw.length < 8) return 'Password must be at least 8 characters long.';
  if (!/[A-Za-z]/.test(pw)) return 'Password must contain at least one letter.';
  if (!/[0-9]/.test(pw)) return 'Password must contain at least one number.';
  return null;
}

export default function Register() {
  const { registerWithEmail, logInWithGoogle } = useAuth();
  const navigate = useNavigate();

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    const pwError = validatePassword(password);
    if (pwError) { setError(pwError); return; }
    setSubmitting(true);
    try {
      await registerWithEmail(email, password, name);
      // The verification gate (AuthGate) takes over from here: the app stays
      // blocked until the new account's email is verified.
      navigate('/', { replace: true });
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
      navigate('/', { replace: true });
    } catch (err: any) {
      setError(normalizeAuthError(err));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="flex justify-center py-10 md:py-16">
      <div className="w-full max-w-md">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="inline-flex bg-[#84cc16] p-3 rounded-2xl text-[#070e0a] shadow-[0_0_25px_rgba(132,204,34,0.5)] mb-4">
            <Radar className="h-8 w-8" />
          </div>
          <h1 className="text-3xl font-extrabold text-white tracking-tight">Create your account</h1>
          <p className="text-gray-400 mt-2">Unlock tailored opportunities in minutes</p>
        </div>

        <div className="glass-card rounded-2xl p-6 md:p-8">
          {/* Google Button */}
          <button
            onClick={handleGoogle}
            disabled={submitting}
            className="w-full flex items-center justify-center gap-3 bg-white text-[#1f2937] font-bold py-3 px-4 rounded-xl hover:bg-gray-100 transition-colors disabled:opacity-70"
          >
            <GoogleIcon className="h-5 w-5" />
            Sign up with Google
          </button>

          {/* Divider */}
          <div className="flex items-center gap-3 my-6">
            <div className="flex-1 h-px bg-white/10"></div>
            <span className="text-xs text-gray-500 uppercase tracking-wider">or</span>
            <div className="flex-1 h-px bg-white/10"></div>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1.5">
                <User className="inline h-4 w-4 mr-1 text-[#84cc16]" /> Full Name
              </label>
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Jane Doe"
                className="w-full h-11 rounded-xl bg-white/5 border border-white/10 px-4 text-sm text-white placeholder:text-gray-500 focus:outline-none focus:border-[#84cc16]/60 focus:ring-2 focus:ring-[#84cc16]/20"
              />
            </div>

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
                className="w-full h-11 rounded-xl bg-white/5 border border-white/10 px-4 text-sm text-white placeholder:text-gray-500 focus:outline-none focus:border-[#84cc16]/60 focus:ring-2 focus:ring-[#84cc16]/20"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1.5">
                <Lock className="inline h-4 w-4 mr-1 text-[#84cc16]" /> Password
              </label>
              <input
                type="password"
                required
                minLength={8}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="At least 8 characters, incl. a letter & number"
                className="w-full h-11 rounded-xl bg-white/5 border border-white/10 px-4 text-sm text-white placeholder:text-gray-500 focus:outline-none focus:border-[#84cc16]/60 focus:ring-2 focus:ring-[#84cc16]/20"
              />
              <p className="mt-1.5 text-[11px] text-gray-500">
                8+ characters with at least one letter and one number.
              </p>
            </div>

            {error && (
              <div className="rounded-xl bg-red-500/10 border border-red-500/30 text-red-300 text-sm px-4 py-3">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={submitting}
              className="w-full h-11 bg-[#84cc16] text-[#070e0a] font-bold rounded-xl hover:bg-[#84cc16]/90 transition-colors shadow-[0_0_20px_rgba(132,204,22,0.35)] disabled:opacity-70 flex items-center justify-center gap-2"
            >
              {submitting ? <Loader2 className="h-5 w-5 animate-spin" /> : <UserPlus className="h-5 w-5" />}
              Create Account
            </button>
          </form>

          <p className="text-center text-sm text-gray-400 mt-6">
            Already have an account?{' '}
            <Link to="/login" className="text-[#84cc16] font-semibold hover:underline">
              Log in
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
    case 'auth/email-already-in-use':
      return 'An account with this email already exists. Try logging in instead.';
    case 'auth/invalid-email':
      return 'Please enter a valid email address.';
    case 'auth/weak-password':
      return 'Password must be at least 8 characters with a letter and a number.';
    case 'auth/popup-closed-by-user':
      return 'Google sign-in was cancelled.';
    default:
      return err?.message || 'An unexpected error occurred.';
  }
}
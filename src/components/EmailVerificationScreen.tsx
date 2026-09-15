import { useState } from 'react';
import { CheckCircle2, Loader2, LogOut, Mail, RefreshCw, ShieldCheck } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

// Full-screen gate: the app is unreachable until the signed-in user's email is
// verified. Verification is enforced before any page renders.
export default function EmailVerificationScreen() {
  const { user, resendVerificationEmail, reloadUser, logout } = useAuth();
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState('');
  const [checking, setChecking] = useState(false);

  const resend = async () => {
    if (sending) return;
    setSending(true);
    setError('');
    setSent(false);
    try {
      await resendVerificationEmail();
      setSent(true);
    } catch (err: any) {
      setError(err?.message || 'Could not send the verification email. Please try again.');
    } finally {
      setSending(false);
    }
  };

  const checkNow = async () => {
    if (checking) return;
    setChecking(true);
    setError('');
    try {
      await reloadUser();
    } catch {
      setError('Could not refresh your verification status. Try again in a moment.');
    } finally {
      setChecking(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#070e0a] px-4 py-10">
      <div className="w-full max-w-md">
        <div className="rounded-2xl glass-card p-8 md:p-10 text-center animate-in fade-in zoom-in-95 duration-200">
          <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-full border border-[#84cc16]/40 bg-[#84cc16]/10">
            <Mail className="h-8 w-8 text-[#84cc16]" />
          </div>

          <span className="inline-flex items-center gap-1.5 rounded-full border border-[#84cc16]/30 bg-[#84cc16]/10 px-3 py-1 text-[11px] font-bold uppercase tracking-widest text-[#84cc16] mb-4">
            <ShieldCheck className="h-3.5 w-3.5" /> Action Required
          </span>

          <h1 className="text-2xl font-extrabold text-white mb-2">Verify your email</h1>
          <p className="text-gray-400 text-sm leading-relaxed mb-6">
            Before you can use PrimeOpportunity, please verify your email address.
            We sent a link to{' '}
            <span className="font-semibold text-[#84cc16]">{user?.email}</span>.
          </p>

          {sent && (
            <div className="mb-4 rounded-lg border border-[#84cc16]/30 bg-[#84cc16]/10 px-4 py-2.5 text-sm text-[#84cc16]">
              <CheckCircle2 className="inline h-4 w-4 -mt-0.5 mr-1" />
              Verification email sent. Check your inbox (and spam folder).
            </div>
          )}
          {error && (
            <div className="mb-4 rounded-lg border border-rose-400/40 bg-rose-400/10 px-4 py-2.5 text-sm text-rose-300">
              {error}
            </div>
          )}

          <div className="flex flex-col gap-2.5">
            <button
              onClick={resend}
              disabled={sending}
              className="w-full inline-flex items-center justify-center gap-2 bg-[#84cc16] text-[#070e0a] font-bold py-3 rounded-lg hover:bg-[#a3e635] transition-colors text-sm disabled:opacity-60"
            >
              {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
              {sending ? 'Sending…' : 'Resend verification email'}
            </button>

            <button
              onClick={checkNow}
              disabled={checking}
              className="w-full inline-flex items-center justify-center gap-2 bg-white/5 border border-white/10 text-gray-200 font-semibold py-3 rounded-lg hover:bg-white/10 transition-colors text-sm disabled:opacity-60"
            >
              {checking ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
              {checking ? 'Checking…' : "I've verified — continue"}
            </button>

            <button
              onClick={() => logout()}
              className="w-full inline-flex items-center justify-center gap-2 text-xs text-gray-500 hover:text-gray-300 transition-colors py-1"
            >
              <LogOut className="h-3.5 w-3.5" /> Log out
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
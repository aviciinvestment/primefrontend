import { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowRight, CheckCircle2, Construction, Handshake, Loader2, Rocket, XCircle } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { API_BASE } from '../lib/applications';
import { apiFetch } from '../lib/api';

export default function MentorshipInterest() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const title = searchParams.get('title') || '';
  const url = searchParams.get('url') || '';
  const fromOpportunity = !!url;

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState(false);

  const answer = async (choice: 'yes' | 'no') => {
    if (!user || saving) return;
    setSaving(true);
    setError('');
    try {
      const res = await apiFetch(`${API_BASE}/users/mentorship-interest`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          choice,
          source: fromOpportunity ? 'opportunity' : 'general',
          opportunityTitle: title,
          opportunityUrl: url,
        }),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error || 'Failed to save your answer.');
      setDone(true);
      if (fromOpportunity) {
        // They were heading to an opportunity — send them there.
        window.location.href = url;
      } else {
        navigate('/');
      }
    } catch (err: any) {
      setError(err?.message || 'Something went wrong. Please try again.');
      setSaving(false);
    }
  };

  return (
    <div className="max-w-xl mx-auto py-10">
      <div className="rounded-2xl glass-card p-6 sm:p-10 text-center animate-in fade-in zoom-in-95 duration-200">
        {done ? (
          <div className="flex items-center justify-center gap-3 text-[#84cc16]">
            <Loader2 className="h-6 w-6 animate-spin" />
            <span className="font-semibold">
              {fromOpportunity ? 'Taking you to the opportunity...' : 'Redirecting you home...'}
            </span>
          </div>
        ) : (
          <>
            <div className="w-16 h-16 mx-auto rounded-full bg-[#84cc16]/15 border border-[#84cc16]/40 flex items-center justify-center mb-5">
              <Construction className="h-8 w-8 text-[#84cc16]" />
            </div>
            <span className="inline-flex items-center gap-1.5 rounded-full border border-[#84cc16]/40 bg-[#84cc16]/10 px-3 py-1 text-[11px] font-bold uppercase tracking-widest text-[#84cc16] mb-4">
              <Rocket className="h-3.5 w-3.5" /> Coming Soon
            </span>
            <h1 className="text-2xl sm:text-3xl font-bold text-white mb-3">Mentorship Program</h1>
            <p className="text-gray-400 text-sm leading-relaxed mb-2">
              We're putting the final touches on our mentorship offering.
              {title && (
                <>
                  {' '}We noticed you're looking at <span className="text-gray-200 font-medium">&ldquo;{title}&rdquo;</span>.
                </>
              )}
            </p>
            <p className="text-gray-300 text-base sm:text-lg font-medium leading-relaxed mb-6">
              Are you open to investing in a mentor who guides you through preparing this application and gives your chances a boost?
            </p>

            {error && (
              <div className="mb-4 rounded-lg border border-rose-400/40 bg-rose-400/10 px-4 py-2.5 text-sm text-rose-300">
                {error}
              </div>
            )}

            {user ? (
              <div className="flex flex-col gap-2.5">
                <button
                  onClick={() => answer('yes')}
                  disabled={saving}
                  className="w-full inline-flex items-center justify-center gap-2 bg-[#84cc16] text-[#0a0f16] font-bold py-3 rounded-lg hover:bg-[#a3e635] transition-colors text-sm disabled:opacity-60"
                >
                  <CheckCircle2 className="h-4 w-4" />
                  {saving ? 'Saving...' : 'Yes, I’m interested'}
                </button>
                <button
                  onClick={() => answer('no')}
                  disabled={saving}
                  className="w-full inline-flex items-center justify-center gap-2 bg-white/5 border border-white/10 text-gray-200 font-semibold py-3 rounded-lg hover:bg-white/10 transition-colors text-sm disabled:opacity-60"
                >
                  <XCircle className="h-4 w-4" />
                  {saving ? 'Saving...' : 'No, not right now'}
                </button>
              </div>
            ) : (
              <button
                onClick={() => navigate('/login')}
                className="w-full inline-flex items-center justify-center gap-2 bg-[#84cc16] text-[#0a0f16] font-bold py-3 rounded-lg hover:bg-[#a3e635] transition-colors text-sm"
              >
                <Handshake className="h-4 w-4" /> Log in to answer
              </button>
            )}

            <p className="mt-6 text-xs text-gray-500">
              {fromOpportunity ? (
                <span className="inline-flex items-center gap-1.5">
                  Your answer is saved{user ? ' and we’ll take you to the opportunity next' : ''}.
                  <ArrowRight className="h-3 w-3" />
                </span>
              ) : (
                'You’ll land back on the home page after answering.'
              )}
            </p>
          </>
        )}
      </div>
    </div>
  );
}
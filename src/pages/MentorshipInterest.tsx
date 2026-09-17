import { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowRight, CheckCircle2, Construction, Handshake, Rocket, XCircle } from 'lucide-react';
import { BreathingLoader } from '../components/BreathingLoader';
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
    <div className="w-full max-w-xl mx-auto px-4 sm:px-6 py-12 sm:py-16">
      <div className="card-surface p-6 sm:p-10 text-center animate-in fade-in zoom-in-95 duration-200">
        {done ? (
          <div className="flex items-center justify-center gap-3 text-[#84cc16] py-4">
            <BreathingLoader size="lg" dots={3} />
            <span className="font-semibold">
              {fromOpportunity ? 'Taking you to the opportunity...' : 'Redirecting you home...'}
            </span>
          </div>
        ) : (
          <>
            <div className="w-16 h-16 mx-auto rounded-full bg-[#84cc16]/10 border border-[#84cc16]/30 flex items-center justify-center mb-6 shadow-[0_0_40px_-12px_rgba(132,204,22,0.5)]">
              <Construction className="h-8 w-8 text-[#84cc16]" />
            </div>
            <span className="eyebrow mb-5">
              <Rocket className="h-3.5 w-3.5" /> Coming Soon
            </span>
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-white mb-3">Mentorship Program</h1>
            <p className="text-sm sm:text-base leading-relaxed text-gray-400 mb-2">
              We're putting the final touches on our mentorship offering.
              {title && (
                <>
                  {' '}We noticed you're looking at <span className="text-gray-200 font-medium">&ldquo;{title}&rdquo;</span>.
                </>
              )}
            </p>
            <p className="text-base sm:text-lg font-medium leading-relaxed text-gray-300 mb-6">
              Are you open to investing in a mentor who guides you through preparing this application and gives your chances a boost?
            </p>

            {error && (
              <div className="mb-5 rounded-xl border border-rose-400/30 bg-rose-400/10 px-4 py-3 text-sm text-rose-200">
                {error}
              </div>
            )}

            {user ? (
              <div className="flex flex-col gap-3">
                <button
                  onClick={() => answer('yes')}
                  disabled={saving}
                  className="btn-primary btn-busy w-full h-12 text-sm px-6"
                >
                  <CheckCircle2 className="h-4 w-4" />
                  {saving ? <><BreathingLoader size="sm" dots={3} tone="dark" /> Saving…</> : 'Yes, I’m interested'}
                </button>
                <button
                  onClick={() => answer('no')}
                  disabled={saving}
                  className="btn-secondary btn-busy w-full h-12 text-sm px-6"
                >
                  <XCircle className="h-4 w-4" />
                  {saving ? <><BreathingLoader size="sm" dots={3} /> Saving…</> : 'No, not right now'}
                </button>
              </div>
            ) : (
              <button
                onClick={() => navigate('/login')}
                className="btn-primary w-full h-12 text-sm px-6"
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
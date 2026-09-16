import { useState, useEffect } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { ArrowLeft, ArrowRight, Briefcase, CheckCircle2, GraduationCap, Handshake, Lock, ShieldCheck } from 'lucide-react';
import { BreathingLoader } from '../components/BreathingLoader';
import { useAuth } from '../context/AuthContext';
import { API_BASE } from '../lib/applications';
import { apiFetch } from '../lib/api';

declare global {
  interface Window {
    PaystackPop?: {
      setup(options: any): { openIframe(): void };
    };
  }
}

interface MentorshipConfig {
  amount: number;
  currency: string;
  paystackPublicKey: string | null;
}

function loadPaystackScript(): Promise<void> {
  return new Promise((resolve, reject) => {
    if (window.PaystackPop) return resolve();
    const el = document.createElement('script');
    el.src = 'https://js.paystack.co/v1/inline.js';
    el.onload = () => resolve();
    el.onerror = () => reject(new Error('Failed to load payment script.'));
    document.body.appendChild(el);
  });
}

const formatMoney = (amount: number, currency: string) =>
  new Intl.NumberFormat('en-NG', { style: 'currency', currency }).format(amount);

export default function MentorshipGuidance() {
  const { user } = useAuth();
  const [searchParams] = useSearchParams();

  const title = searchParams.get('title') || 'this opportunity';
  const org = searchParams.get('org') || '';
  const url = searchParams.get('url') || '';
  const opportunityId = searchParams.get('id') || undefined;
  const opportunityType = searchParams.get('type') || '';
  const opportunityCategory = searchParams.get('category') || '';

  const [config, setConfig] = useState<MentorshipConfig | null>(null);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [note, setNote] = useState('');
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState('');
  const [confirmed, setConfirmed] = useState<null | { reference: string }>(null);

  useEffect(() => {
    fetch(`${API_BASE}/mentorships/config`)
      .then(res => res.json())
      .then(data => {
        if (data.success) {
          setConfig({ amount: data.amount, currency: data.currency, paystackPublicKey: data.paystackPublicKey || null });
          if (data.paystackPublicKey) loadPaystackScript().catch(() => setError('Payment script failed to load.'));
        }
      })
      .catch(() => setError('Could not load payment settings.'));
  }, []);

  const submitRequest = async (provider: string, reference: string) => {
    const res = await apiFetch(`${API_BASE}/mentorships`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        userEmail: email || user?.email,
        userName: name,
        opportunityId,
        opportunityTitle: title,
        opportunityOrg: org,
        opportunityUrl: url,
        opportunityType,
        opportunityCategory,
        amount: config!.amount,
        currency: config!.currency,
        provider,
        reference,
        note,
      }),
    });
    const data = await res.json();
    if (!data.success) throw new Error(data.error || 'Failed to submit your request.');
  };

  const handlePay = async () => {
    if (!config || !user) return;
    setError('');
    setProcessing(true);
    try {
      if (config.paystackPublicKey) {
        const ref = `MSC-${Date.now()}`;
        await loadPaystackScript();
        const handler = window.PaystackPop!.setup({
          key: config.paystackPublicKey,
          email: email || user.email || 'student@primeopportunity.app',
          amount: config.amount * 100,
          currency: config.currency,
          ref,
          callback: async () => { await submitRequest('paystack', ref); setConfirmed({ reference: ref }); },
          onClose: () => setProcessing(false),
        });
        handler.openIframe();
        setProcessing(false);
      } else {
        setError('Payments are not enabled yet. Please try again later.');
      }
    } catch (err: any) {
      setError(err?.message || 'Payment failed. Please try again.');
    } finally {
      setProcessing(false);
    }
  };

  if (confirmed) {
    return (
      <div className="w-full max-w-xl mx-auto px-4 sm:px-6 py-10 sm:py-14">
        <div className="card-surface p-6 sm:p-10 text-center animate-in fade-in zoom-in-95 duration-200">
          <div className="w-16 h-16 mx-auto rounded-full bg-[#84cc16]/10 border border-[#84cc16]/30 flex items-center justify-center mb-6 shadow-[0_0_40px_-12px_rgba(132,204,22,0.5)]">
            <CheckCircle2 className="h-8 w-8 text-[#84cc16]" />
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-white mb-3">Request received!</h1>
          <p className="text-gray-300 text-sm leading-relaxed mb-1">
            Your mentorship guidance request has been submitted for “{title}”.
          </p>
          <p className="text-gray-500 text-xs mb-6">
            Reference: <span className="font-mono text-gray-300">{confirmed.reference}</span>
          </p>
          <p className="text-gray-400 text-sm leading-relaxed mb-8">
            A mentor will reach out to you shortly. Keep an eye on your email and the Profile page for updates.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            {url && (
              <a
                href={url}
                target="_blank"
                rel="noopener noreferrer"
                className="btn-primary h-11 px-6 text-sm"
              >
                Visit the opportunity <ArrowRight className="h-4 w-4" />
              </a>
            )}
            <Link
              to="/"
              className="btn-secondary h-11 px-6 text-sm"
            >
              Back to Dashboard
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full max-w-4xl mx-auto px-4 sm:px-6 py-8 sm:py-12">
      <Link to="/" className="inline-flex items-center gap-2 text-sm text-gray-400 transition-colors hover:text-white focus-ring rounded-lg mb-6">
        <ArrowLeft className="h-4 w-4" /> Back to opportunities
      </Link>

      <div className="mb-8">
        <div className="flex items-center gap-3 mb-3">
          <div className="w-10 h-10 shrink-0 rounded-xl bg-[#84cc16]/10 border border-[#84cc16]/30 flex items-center justify-center">
            <Handshake className="h-5 w-5 text-[#84cc16]" />
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-white">Mentorship Guidance</h1>
        </div>
        <p className="text-sm sm:text-base leading-relaxed text-gray-400">
          Get a 1-on-1 session with someone already in the industry while you apply.
        </p>
      </div>

      <div className="grid md:grid-cols-5 gap-6 items-start">
        <div className="md:col-span-3 space-y-4 min-w-0">
          <div className="card-surface p-6 sm:p-8">
            <h2 className="text-xs font-bold uppercase tracking-widest text-[#84cc16] mb-4">Opportunity you're applying to</h2>
            <div className="flex items-start gap-3 min-w-0">
              <div className="w-9 h-9 shrink-0 rounded-lg bg-white/5 border border-white/10 flex items-center justify-center">
                <Briefcase className="h-4 w-4 text-gray-300" />
              </div>
              <div className="min-w-0">
                <p className="text-white font-semibold leading-snug break-words">{title}</p>
                {org && <p className="text-gray-400 text-sm mt-1">{org}</p>}
              </div>
            </div>
            {url && (
              <a
                href={url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 mt-4 text-xs font-medium text-[#84cc16] hover:text-[#a3e635] focus-ring rounded-md transition-colors"
              >
                View listing <ArrowRight className="h-3 w-3" />
              </a>
            )}
          </div>

          <div className="card-surface p-6 sm:p-8">
            <h2 className="text-xs font-bold uppercase tracking-widest text-gray-300 mb-4">Your details</h2>
            <div className="space-y-4">
              <input
                value={name}
                onChange={e => setName(e.target.value)}
                placeholder="Full name (optional)"
                className="input-base"
              />
              <input
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="Email (optional, default: your account email)"
                className="input-base"
              />
              <textarea
                value={note}
                onChange={e => setNote(e.target.value)}
                placeholder="Anything the mentor should know? (optional)"
                rows={3}
                className="input-base resize-none min-h-28 py-3"
              />
            </div>
          </div>
        </div>

        <div className="md:col-span-2 min-w-0">
          <div className="card-surface p-6 sm:p-8 sticky top-6">
            <div className="flex items-center gap-2 mb-3">
              <GraduationCap className="h-4 w-4 text-[#84cc16]" />
              <h2 className="text-xs font-bold uppercase tracking-widest text-gray-300">Application Guidance</h2>
            </div>
            <ul className="space-y-3 mb-6 text-sm leading-relaxed text-gray-400">
              <li className="flex items-start gap-2"><ShieldCheck className="h-4 w-4 mt-0.5 text-[#84cc16] shrink-0" /> Review your application so it stands out</li>
              <li className="flex items-start gap-2"><ShieldCheck className="h-4 w-4 mt-0.5 text-[#84cc16] shrink-0" /> 1-on-1 session with an industry mentor</li>
              <li className="flex items-start gap-2"><ShieldCheck className="h-4 w-4 mt-0.5 text-[#84cc16] shrink-0" /> Actionable feedback on your chances & next steps</li>
            </ul>
            <div className="flex items-baseline gap-2 mb-6">
              {config ? (
                <>
                  <span className="text-3xl sm:text-4xl font-extrabold tracking-tight text-white">{formatMoney(config.amount, config.currency)}</span>
                  <span className="text-gray-500 text-sm">one-time</span>
                </>
              ) : (
                <span className="text-3xl sm:text-4xl font-extrabold tracking-tight text-white">…</span>
              )}
            </div>

            {error && <p className="text-rose-400 text-xs mb-3">{error}</p>}

            <button
              onClick={handlePay}
              disabled={!config || processing}
              className="btn-primary w-full h-12 text-sm"
            >
              {processing ? (
                <><BreathingLoader size="sm" dots={3} /> Processing…</>
              ) : (
                <><Lock className="h-4 w-4" /> Pay & Apply for Guidance</>
              )}
            </button>

            {config && !config.paystackPublicKey && (
              <p className="text-xs leading-relaxed text-gray-500 mt-4 border-t border-white/10 pt-4">
                Payments are not enabled yet. Add <span className="font-mono text-gray-400">PAYSTACK_PUBLIC_KEY</span> to the server .env to enable card payments.
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
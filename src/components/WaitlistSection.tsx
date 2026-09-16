import { useEffect, useState, type FormEvent } from 'react';
import { ArrowRight, CheckCircle2, Clock, Gift, Loader2, Mail, Users } from 'lucide-react';
import { API_BASE, type LaunchStatus } from '../lib/applications';

interface Props {
  launch: LaunchStatus | null;
  loading?: boolean;
  onCountChange?: (count: number) => void;
}

const formatCountdown = (ms: number) => {
  const totalSec = Math.max(0, Math.floor(ms / 1000));
  const d = Math.floor(totalSec / 86400);
  const h = Math.floor((totalSec % 86400) / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  const pad = (n: number) => String(n).padStart(2, '0');
  return { d: String(d).padStart(2, '0'), h: pad(h), m: pad(m), s: pad(s) };
};

export default function WaitlistSection({ launch, loading, onCountChange }: Props) {
  const [email, setEmail] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [joined, setJoined] = useState(false);
  const [nowMs, setNowMs] = useState(() => Date.now());

  useEffect(() => {
    const id = setInterval(() => setNowMs(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  // Fields below the fold fill in as soon as the backend reply lands; while it
  // loads we render the placeholder countdown so the page is never blank.
  const ready = !loading && launch;
  const deadline = launch?.deadline
    ? new Date(launch.deadline).getTime()
    : launch
      ? nowMs + (launch.countdownMs || 0)
      : nowMs + 30 * 24 * 60 * 60 * 1000;
  const remaining = deadline - nowMs;
  const cd = ready ? formatCountdown(remaining) : { d: '– –', h: '– –', m: '– –', s: '– –' };

  // When the countdown runs out the server auto-launches — reload so the home
  // page swaps the waitlist for the real feed.
  const expired = ready && remaining <= 0;
  useEffect(() => {
    if (expired) {
      const t = setTimeout(() => window.location.reload(), 600);
      return () => clearTimeout(t);
    }
  }, [expired]);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!email.trim() || submitting) return;
    setSubmitting(true);
    setError('');
    try {
      const res = await fetch(`${API_BASE}/launch/waitlist`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim() }),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error || 'Something went wrong.');
      setJoined(true);
      onCountChange?.(data.waitlistCount);
      if (data.whatsappGroupUrl && /^https:\/\//.test(data.whatsappGroupUrl)) {
        window.location.href = data.whatsappGroupUrl; // send them to the WhatsApp group
        return;
      }
    } catch (err: any) {
      setError(err?.message || 'Something went wrong. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="relative overflow-hidden rounded-[1.5rem] sm:rounded-[2rem] border border-white/10 bg-gradient-to-b from-white/[0.06] to-white/[0.02] px-4 py-12 text-center shadow-[0_20px_60px_-20px_rgba(0,0,0,0.7),inset_0_1px_1px_rgba(255,255,255,0.08)] sm:px-8 md:px-12 md:py-16">
      {/* Decorative top accent line — premium, compositor-free */}
      <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-[#84cc16]/60 to-transparent" aria-hidden="true"></div>

      {/* Soft radial glow behind hero content */}
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(132,204,22,0.06),transparent_60%)]" aria-hidden="true"></div>

      <div className="relative z-10">
        <div className="flex flex-wrap items-center justify-center gap-3">
          <span className="eyebrow">
            <Gift className="h-3.5 w-3.5" aria-hidden="true" /> Coming soon
          </span>
          <span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-[11px] font-semibold text-gray-300">
            <Users className="h-3.5 w-3.5 text-[#84cc16]" aria-hidden="true" />
            {launch?.waitlistCount ?? 0} person{launch?.waitlistCount === 1 ? '' : 's'} on the waitlist
          </span>
        </div>

        <h1 className="mx-auto mt-8 max-w-2xl text-3xl leading-tight font-extrabold tracking-tight text-white sm:text-4xl md:text-5xl">
          Prime Opportunity is <span className="text-[#84cc16]">launching soon</span>
        </h1>
        <p className="mx-auto mt-4 max-w-lg text-base leading-relaxed text-gray-400 sm:text-lg">
          Scholarships, internships, and graduate programs matched to you — with AI guidance to help you apply.
          Join the waitlist to be the first in when we open the doors.
        </p>

        {/* Countdown — fluid grid prevents horizontal overflow at 320px */}
        <div className="mx-auto mt-8 flex max-w-sm items-start justify-center gap-2 sm:max-w-md sm:gap-3" aria-label="Countdown timer">
          <div className="mt-1 hidden shrink-0 text-gray-500 sm:block" aria-hidden="true">
            <Clock className="h-4 w-4" />
          </div>
          {[
            { v: cd.d, l: 'Days' },
            { v: cd.h, l: 'Hrs' },
            { v: cd.m,  l: 'Min' },
            { v: cd.s,  l: 'Sec' },
          ].map(unit => (
            <div
              key={unit.l}
              className="flex min-w-0 flex-1 flex-col items-center rounded-xl border border-white/10 bg-white/[0.03] px-1 py-2.5 transition-colors hover:border-white/20 sm:px-3 sm:py-3"
            >
              <span className="w-full truncate text-center text-xl tabular-nums font-bold text-white sm:text-3xl">{unit.v}</span>
              <span className="mt-0.5 text-[10px] font-semibold uppercase tracking-wider text-gray-500">{unit.l}</span>
            </div>
          ))}
        </div>

        {/* Join form */}
        <div className="mx-auto mt-10 max-w-md">
          {joined ? (
            <div className="rounded-2xl border border-[#84cc16]/40 bg-[#84cc16]/10 p-5 text-left" role="status">
              <CheckCircle2 className="mb-2 h-6 w-6 text-[#84cc16]" aria-hidden="true" />
              <p className="text-sm font-medium text-[#e5ffd9]">
                You're on the waitlist{launch?.whatsappGroupUrl ? ' — opening the WhatsApp group…' : ". We'll notify you when we launch."}
              </p>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-3" noValidate>
              {error && (
                <div className="rounded-xl border border-rose-400/40 bg-rose-400/10 px-4 py-3 text-left text-sm text-rose-300" role="alert" aria-live="polite">
                  {error}
                </div>
              )}
              <div className="flex flex-col gap-3 sm:flex-row">
                <div className="relative flex-1">
                  <Mail className="pointer-events-none absolute left-3.5 top-1/2 h-5 w-5 -translate-y-1/2 text-gray-500" aria-hidden="true" />
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    placeholder="Enter your Gmail address"
                    aria-label="Email address"
                    className="input-base pl-11"
                  />
                </div>
                <button
                  type="submit"
                  disabled={submitting}
                  className="btn-primary h-11 shrink-0 px-6 whitespace-nowrap"
                >
                  {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <>
                    Join the waitlist <ArrowRight className="h-4 w-4" />
                  </>}
                </button>
              </div>
              <p className="px-1 text-left text-[11px] text-gray-500">
                After joining, we'll take you to our WhatsApp community.
              </p>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
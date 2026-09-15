import { useEffect, useState, type FormEvent } from 'react';
import { ArrowRight, CheckCircle2, Clock, Gift, Loader2, Mail, Users } from 'lucide-react';
import { API_BASE, type LaunchStatus } from '../lib/applications';

interface Props {
  launch: LaunchStatus;
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

export default function WaitlistSection({ launch, onCountChange }: Props) {
  const [email, setEmail] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [joined, setJoined] = useState(false);
  const [nowMs, setNowMs] = useState(() => Date.now());

  useEffect(() => {
    const id = setInterval(() => setNowMs(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  const deadline = launch.deadline ? new Date(launch.deadline).getTime() : nowMs + launch.countdownMs;
  const remaining = deadline - nowMs;
  const cd = formatCountdown(remaining);

  // When the countdown runs out the server auto-launches — reload so the home
  // page swaps the waitlist for the real feed.
  const expired = remaining <= 0;
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
      if (data.whatsappGroupUrl) {
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
    <div className="relative rounded-[2rem] bg-white/[0.02] backdrop-blur-[50px] border border-white/10 shadow-[0_20px_60px_rgba(0,0,0,0.6),inset_0_1px_1px_rgba(255,255,255,0.1)] overflow-hidden px-6 py-14 sm:px-12 sm:py-20 text-center">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-2 rounded-full border border-[#84cc16]/30 bg-[#84cc16]/10 px-3 py-1 text-xs font-bold uppercase tracking-widest text-[#84cc16]">
          <Gift className="h-3.5 w-3.5" /> Coming soon
        </div>
        <div className="flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs font-semibold text-gray-300">
          <Users className="h-3.5 w-3.5 text-[#84cc16]" />
          {launch.waitlistCount} person{launch.waitlistCount === 1 ? '' : 's'} on the waitlist
        </div>
      </div>

      <h1 className="mt-8 text-3xl sm:text-5xl font-extrabold text-white leading-tight tracking-tight">
        Prime Opportunity is <span className="text-[#84cc16]">launching soon</span>
      </h1>
      <p className="mx-auto mt-4 max-w-xl text-gray-400 text-base sm:text-lg leading-relaxed">
        Scholarships, internships, and graduate programs matched to you — with AI guidance to help you apply.
        Join the waitlist to be the first in when we open the doors.
      </p>

      {/* Countdown */}
      <div className="mt-8 flex items-center justify-center gap-3 sm:gap-4">
        <div className="flex items-center gap-1.5 mr-2 text-gray-500">
          <Clock className="h-4 w-4" />
        </div>
        {[
          { v: cd.d, l: 'Days' },
          { v: cd.h, l: 'Hours' },
          { v: cd.m, l: 'Minutes' },
          { v: cd.s, l: 'Seconds' },
        ].map(unit => (
          <div key={unit.l} className="rounded-xl border border-white/10 bg-white/[0.03] px-3 sm:px-4 py-2.5 sm:py-3">
            <div className="text-2xl sm:text-3xl font-bold text-white tabular-nums">{unit.v}</div>
            <div className="text-[10px] uppercase tracking-wider text-gray-500 mt-0.5">{unit.l}</div>
          </div>
        ))}
      </div>

      {/* Join form */}
      <div className="mx-auto mt-10 max-w-lg">
        {joined ? (
          <div className="rounded-2xl border border-[#84cc16]/40 bg-[#84cc16]/10 p-5 flex items-center gap-3">
            <CheckCircle2 className="h-6 w-6 text-[#84cc16] shrink-0" />
            <p className="text-sm text-[#e5ffd9] font-medium">
              You're on the waitlist{launch.whatsappGroupUrl ? ' — opening the WhatsApp group…' : ". We'll notify you when we launch."}
            </p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-3">
            {error && (
              <div className="rounded-lg border border-rose-400/40 bg-rose-400/10 px-4 py-2.5 text-sm text-rose-300 text-left">
                {error}
              </div>
            )}
            <div className="flex flex-col sm:flex-row gap-3">
              <div className="relative flex-1">
                <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-500" />
                <input
                  type="email"
                  required
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  placeholder="Enter your Gmail address"
                  className="w-full rounded-xl border border-white/10 bg-white/[0.05] py-3 pl-11 pr-4 text-sm text-white placeholder-gray-500 outline-none focus:border-[#84cc16]/60 focus:ring-1 focus:ring-[#84cc16]/40 transition-colors"
                />
              </div>
              <button
                type="submit"
                disabled={submitting}
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#84cc16] px-6 py-3 text-sm font-bold text-[#0a0f16] shadow-[0_0_15px_rgba(132,204,22,0.35)] transition-all hover:bg-[#a3e635] active:scale-95 disabled:opacity-60"
              >
                {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <>
                  Join the waitlist <ArrowRight className="h-4 w-4" />
                </>}
              </button>
            </div>
            <p className="text-xs text-gray-500">
              After joining, we'll take you to our WhatsApp community.
            </p>
          </form>
        )}
      </div>
    </div>
  );
}
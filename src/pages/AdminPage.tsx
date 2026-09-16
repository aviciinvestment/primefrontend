import { useEffect, useState, useCallback } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  Eye,
  EyeOff,
  Handshake,
  Link2,
  Loader2,
  Rocket,
  ShieldBan,
  ShieldCheck,
  Timer,
  Users,
  Wallet,
  XCircle,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { API_BASE, isAdminPreviewEnabled, setAdminPreviewEnabled } from '../lib/applications';
import { apiFetch } from '../lib/api';

const formatMoney = (amount: number, currency: string = 'NGN') =>
  new Intl.NumberFormat('en-NG', { style: 'currency', currency }).format(amount);

const formatDate = (d?: string | Date | null) =>
  d ? new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '—';

interface AppUserRow {
  uid: string; email: string; displayName: string; role: string; createdAt: string;
  mentorshipInterest?: {
    choice: 'yes' | 'no' | null;
    source: 'opportunity' | 'general';
    opportunityTitle: string;
    opportunityUrl: string;
    answeredAt?: string;
  } | null;
}
interface LaunchAdmin {
  launched: boolean;
  launchedAt: string | null;
  welcomeUntil: string | null;
  countdownMs: number;
  deadline: string | null;
  whatsappGroupUrl: string;
  waitlistCount: number;
  waitlist: Array<{ email: string; joinedAt: string }>;
}
interface MentorRow {
  userId: string; name: string; email: string; company: string; roleType: string;
  status: 'pending' | 'approved' | 'rejected'; menteesCount: number; accountBalance: number; createdAt: string;
}
interface MenteeRow {
  id: string; userName?: string; userEmail?: string; opportunityTitle?: string; opportunityOrg?: string;
  opportunityType?: string; mentorId?: string; mentorName?: string; amount: number; currency: string;
  platformCut: number; mentorCut: number; reference: string; createdAt: string;
}
interface Overview {
  totalUsers: number; totalMentors: number; pendingMentorApplications: number;
  totalMentees: number; paidMenteeCount: number; grossRevenue: number; platformRevenue: number; mentorPayout: number;
}
interface ComplaintRow {
  id: string; ticket: string; userId?: string; userEmail?: string; userName?: string;
  message: string; status: 'open' | 'resolved';
  createdAt: string;
  payments: Array<{ reference: string; amount: number; currency: string; mentorName: string; createdAt: string }>;
}

const statusBadge = (status: string) =>
  status === 'approved' ? 'border border-emerald-400/40 bg-emerald-400/10 text-emerald-300'
  : status === 'pending' ? 'border border-amber-400/40 bg-amber-400/10 text-amber-300'
  : 'border border-rose-400/40 bg-rose-400/10 text-rose-300';

export default function AdminPage() {
  const { user, isAdmin, role } = useAuth();

  const [overview, setOverview] = useState<Overview | null>(null);
  const [users, setUsers] = useState<AppUserRow[]>([]);
  const [mentors, setMentors] = useState<MentorRow[]>([]);
  const [mentees, setMentees] = useState<MenteeRow[]>([]);
  const [complaints, setComplaints] = useState<ComplaintRow[]>([]);
  const [launch, setLaunch] = useState<LaunchAdmin | null>(null);
  const [timerInput, setTimerInput] = useState('5');
  const [waInput, setWaInput] = useState('');
  const [launchBusy, setLaunchBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [notice, setNotice] = useState('');
  const [adminPreview, setAdminPreview] = useState(() => isAdminPreviewEnabled());

  const toggleAdminPreview = () => {
    const next = !adminPreview;
    setAdminPreview(next);
    setAdminPreviewEnabled(next);
    setNotice(
      next
        ? 'Preview mode ON — browse the app at "/" yourself while everyone else still sees the waitlist. Launch state untouched.'
        : 'Preview mode OFF — you will see the waitlist again like everyone else.'
    );
  };

  const load = useCallback(async () => {
    if (!user || !isAdmin) return;
    setLoading(true);
    try {
      const [o, u, m, e, c, l] = await Promise.all([
        apiFetch(`${API_BASE}/admin/overview`).then(r => r.json()),
        apiFetch(`${API_BASE}/admin/users`).then(r => r.json()),
        apiFetch(`${API_BASE}/admin/mentors`).then(r => r.json()),
        apiFetch(`${API_BASE}/admin/mentees`).then(r => r.json()),
        apiFetch(`${API_BASE}/admin/complaints`).then(r => r.json()),
        apiFetch(`${API_BASE}/admin/launch`).then(r => r.json()),
      ]);
      if (o.success) setOverview(o);
      if (u.success) setUsers(u.users);
      if (m.success) setMentors(m.mentors);
      if (e.success) setMentees(e.mentees);
      if (c.success) setComplaints(c.complaints);
      if (l.success) {
        setLaunch(l);
        setTimerInput(String(Math.round((l.countdownMs || 0) / (24 * 60 * 60 * 1000))));
        setWaInput(l.whatsappGroupUrl || '');
      }
    } catch (err) {
      console.error('Failed to load admin data:', err);
    } finally {
      setLoading(false);
    }
  }, [user, isAdmin]);

  useEffect(() => { load(); }, [load]);

  const act = async (path: string, okMsg: string) => {
    if (!user) return;
    const res = await apiFetch(`${API_BASE}/admin/${path}`, { method: 'POST' });
    const data = await res.json();
    if (data.success) {
      setNotice(okMsg);
      await load();
    } else {
      setNotice(data.error || 'Action failed.');
    }
  };

  const launchPost = async (path: string, body: Record<string, unknown>, okMsg: string) => {
    if (!user || launchBusy) return;
    setLaunchBusy(true);
    try {
      const res = await apiFetch(`${API_BASE}/admin/${path}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      setNotice(data.success ? okMsg : (data.error || 'Action failed.'));
      if (data.success) await load();
    } catch {
      setNotice('Action failed.');
    } finally {
      setLaunchBusy(false);
    }
  };

  if (!user || !isAdmin) {
    return (
      <div className="max-w-xl mx-auto py-16">
        <div className="card-surface p-8 text-center">
          <div className="w-14 h-14 mx-auto rounded-full bg-rose-400/10 border border-rose-400/30 flex items-center justify-center mb-4">
            <ShieldBan className="h-6 w-6 text-rose-400" />
          </div>
          <h1 className="text-xl sm:text-2xl font-extrabold tracking-tight text-white mb-2">Admin access only</h1>
          <p className="text-gray-400 text-sm sm:text-base mb-6">
            You need to be promoted to an administrator to view this page.
          </p>
          <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4 text-left text-sm">
            <p className="text-gray-300">
              <span className="font-semibold text-gray-200">Signed in as:</span> {user?.email || '—'}{' '}
              <span className="text-gray-500">(uid: {(user as any)?.uid || '—'})</span>
            </p>
            <p className="text-gray-300 mt-1">
              <span className="font-semibold text-gray-200">Resolved role:</span>{' '}
              <span className={role === 'admin' ? 'text-[#84cc16]' : 'text-amber-300'}>
                {role ?? 'unknown (role not synced yet)'}
              </span>
            </p>
            <p className="text-gray-500 mt-2 text-xs leading-relaxed">
              If the role shows "user", the server did not recognize you as an admin — make sure{' '}
              <code className="text-gray-300">ADMIN_UIDS</code> in the server <code className="text-gray-300">.env</code>{' '}
              contains your Firebase uid, then restart the server and refresh this page.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="section-shell pb-12">
      {/* Header */}
      <div className="mb-8">
        <span className="eyebrow mb-3"><ShieldCheck className="h-3.5 w-3.5" /> Platform</span>
        <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-white">Admin</h1>
        <p className="text-gray-400 text-sm sm:text-base mt-1">Users, mentors, and platform revenue.</p>
      </div>

      {notice && (
        <div className="flex items-center gap-2.5 rounded-xl border border-[#84cc16]/30 bg-[#84cc16]/10 px-4 py-3 text-sm font-medium text-[#84cc16] mb-6">
          <CheckCircle2 className="h-4 w-4 shrink-0" /> {notice}
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-20 text-gray-400">
          <Loader2 className="h-5 w-5 animate-spin mr-2" /> Loading…
        </div>
      ) : (
        <div className="space-y-6 animate-in fade-in duration-200">
          {/* Overview cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <Stat icon={<Users className="h-5 w-5" />} label="Total Users" value={String(overview?.totalUsers ?? '—')} />
            <Stat icon={<Handshake className="h-5 w-5" />} label="Mentors (Approved)" value={String(overview?.totalMentors ?? '—')} />
            <Stat icon={<Wallet className="h-5 w-5" />} label="Platform 10% Cut" value={formatMoney(overview?.platformRevenue ?? 0)} sub={`of ${formatMoney(overview?.grossRevenue ?? 0)} gross`} />
            <Stat icon={<Wallet className="h-5 w-5" />} label="Mentor Payouts (90%)" value={formatMoney(overview?.mentorPayout ?? 0)} sub={`${overview?.paidMenteeCount ?? 0} paid mentee${((overview?.paidMenteeCount ?? 0) === 1 ? '' : 's')}`} />
          </div>

          {/* Launch & Waitlist */}
          <section className="card-surface p-6 overflow-hidden">
            <div className="mb-4">
              <h2 className="flex items-center gap-2 text-sm font-bold text-white uppercase tracking-wide">
                <Rocket className="h-4 w-4 text-[#84cc16]" /> App Launch & Waitlist
              </h2>
              <p className="text-gray-500 text-xs mt-0.5">Launch/unlaunch the app, tune the countdown, set the WhatsApp group, and see who's on the waitlist.</p>
            </div>
            <div className="grid lg:grid-cols-2 gap-6">
              <div className="space-y-4">
                {/* Status + launch toggle */}
                <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
                  <div className="flex items-center justify-between gap-3 flex-wrap">
                    <div>
                      <p className="text-[10px] uppercase tracking-wider text-gray-500 mb-1">App status</p>
                      <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-semibold uppercase ${launch?.launched ? 'border border-[#84cc16]/40 bg-[#84cc16]/10 text-[#84cc16]' : 'border border-amber-400/40 bg-amber-400/10 text-amber-300'}`}>
                        {launch?.launched ? <><Rocket className="h-3.5 w-3.5" /> Launched</> : <><Timer className="h-3.5 w-3.5" /> Waitlist mode</>}
                      </span>
                    </div>
                    <button
                      disabled={launchBusy}
                      onClick={() => launchPost(
                        'launch/state',
                        { launched: !launch?.launched },
                        launch?.launched ? 'App unlaunched — waitlist is back.' : 'App launched — opportunities are live.'
                      )}
                      className={`inline-flex items-center gap-1.5 h-10 rounded-xl px-3.5 text-xs font-semibold transition-all duration-200 active:scale-[0.97] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#84cc16]/60 focus-visible:ring-offset-2 focus-visible:ring-offset-[#070e0a] disabled:pointer-events-none disabled:opacity-50 ${launch?.launched ? 'bg-amber-400/10 text-amber-300 border border-amber-400/30 hover:bg-amber-400/20' : 'bg-[#84cc16]/10 text-[#84cc16] border border-[#84cc16]/30 hover:bg-[#84cc16]/20'}`}
                    >
                      {launch?.launched ? <><XCircle className="h-3.5 w-3.5" /> Unlaunch app</> : <><Rocket className="h-3.5 w-3.5" /> Launch app</>}
                    </button>
                  </div>
                  {launch?.launchedAt && (
                    <p className="mt-3 text-xs text-gray-500">
                      Launched on {formatDate(launch.launchedAt)} — welcome banner shows until {formatDate(launch.welcomeUntil)}.
                    </p>
                  )}
                </div>

                {/* Admin-only preview — never touches the real launch state */}
                <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
                  <div className="flex items-center justify-between gap-3 flex-wrap">
                    <div>
                      <p className="text-[10px] uppercase tracking-wider text-gray-500 mb-1">Admin-only preview</p>
                      <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-semibold uppercase ${adminPreview ? 'border border-[#84cc16]/40 bg-[#84cc16]/10 text-[#84cc16]' : 'border border-white/10 bg-white/5 text-gray-400'}`}>
                        {adminPreview ? <><Eye className="h-3.5 w-3.5" /> Preview on</> : <><EyeOff className="h-3.5 w-3.5" /> Preview off</>}
                      </span>
                    </div>
                    <button
                      onClick={toggleAdminPreview}
                      className={`inline-flex items-center gap-1.5 h-10 rounded-xl px-3.5 text-xs font-semibold transition-all duration-200 active:scale-[0.97] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#84cc16]/60 focus-visible:ring-offset-2 focus-visible:ring-offset-[#070e0a] ${adminPreview ? 'bg-amber-400/10 text-amber-300 border border-amber-400/30 hover:bg-amber-400/20' : 'bg-[#84cc16]/10 text-[#84cc16] border border-[#84cc16]/30 hover:bg-[#84cc16]/20'}`}
                    >
                      {adminPreview ? <><EyeOff className="h-3.5 w-3.5" /> Turn preview off</> : <><Eye className="h-3.5 w-3.5" /> Preview the app</>}
                    </button>
                  </div>
                  <p className="mt-3 text-xs text-gray-500 leading-relaxed">
                    Lets only <span className="text-gray-300">you</span> browse the live app at
                    <span className="text-[#84cc16] font-semibold"> "/" </span>
                    while everyone else still sees the waitlist. This only sets a flag in your browser —
                    the launch state, countdown, deadline, and waitlist are never modified.
                  </p>
                </div>

                {/* Countdown timer */}
                <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4 space-y-2.5">
                  <p className="text-[10px] uppercase tracking-wider text-gray-500 flex items-center gap-1.5">
                    <Timer className="h-3.5 w-3.5" /> Auto-launch countdown
                  </p>
                  <div className="flex gap-2 items-center">
                    <input
                      type="number"
                      min={1}
                      value={timerInput}
                      onChange={e => setTimerInput(e.target.value)}
                      className="h-11 w-24 rounded-xl border border-white/10 bg-white/[0.04] px-3 text-sm text-white outline-none focus:border-[#84cc16]/50 focus:ring-2 focus:ring-[#84cc16]/25 transition-all duration-200"
                    />
                    <span className="text-sm text-gray-400 self-center">day(s)</span>
                    <button
                      disabled={launchBusy}
                      onClick={() => launchPost('launch/timer', { days: Number(timerInput) }, `Countdown set to ${timerInput} day(s).`)}
                      className="ml-auto inline-flex items-center gap-1.5 h-10 rounded-xl bg-[#84cc16]/10 text-[#84cc16] border border-[#84cc16]/30 text-xs font-semibold px-3.5 hover:bg-[#84cc16]/20 transition-all duration-200 active:scale-[0.97] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#84cc16]/60 focus-visible:ring-offset-2 focus-visible:ring-offset-[#070e0a] disabled:pointer-events-none disabled:opacity-50"
                    >
                      <CheckCircle2 className="h-3.5 w-3.5" /> Set timer
                    </button>
                  </div>
                  <p className="text-xs text-gray-500">
                    {launch?.launched
                      ? 'App is live — the countdown only matters when unlaunched.'
                      : `If nobody launches manually, the app auto-launches on ${formatDate(launch?.deadline)}.`}
                  </p>
                </div>

                {/* WhatsApp group */}
                <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4 space-y-2.5">
                  <p className="text-[10px] uppercase tracking-wider text-gray-500 flex items-center gap-1.5">
                    <Link2 className="h-3.5 w-3.5" /> WhatsApp group link
                  </p>
                  <input
                    type="text"
                    value={waInput}
                    onChange={e => setWaInput(e.target.value)}
                    placeholder="https://chat.whatsapp.com/…"
                    className="input-base"
                  />
                  <div className="flex items-center justify-between gap-2.5">
                    <p className="text-xs text-gray-500">Users go here right after joining the waitlist.</p>
                    <button
                      disabled={launchBusy}
                      onClick={() => launchPost('launch/whatsapp', { url: waInput.trim() }, 'WhatsApp group link saved.')}
                      className="inline-flex items-center gap-1.5 h-10 rounded-xl bg-[#84cc16]/10 text-[#84cc16] border border-[#84cc16]/30 text-xs font-semibold px-3.5 hover:bg-[#84cc16]/20 transition-all duration-200 active:scale-[0.97] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#84cc16]/60 focus-visible:ring-offset-2 focus-visible:ring-offset-[#070e0a] disabled:pointer-events-none disabled:opacity-50 shrink-0"
                    >
                      <Link2 className="h-3.5 w-3.5" /> Save link
                    </button>
                  </div>
                </div>
              </div>

              {/* Waitlist emails */}
              <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
                <p className="text-[10px] uppercase tracking-wider text-gray-500 mb-2 flex items-center gap-1.5">
                  <Users className="h-3.5 w-3.5" /> Waitlist ({launch?.waitlistCount ?? 0})
                </p>
                {launch && launch.waitlist.length === 0 ? (
                  <p className="text-sm text-gray-500">Nobody has joined yet.</p>
                ) : (
                  <div className="max-h-80 overflow-y-auto pr-1 space-y-1.5">
                    {launch?.waitlist.map(w => (
                      <div key={w.email} className="flex items-center justify-between gap-3 rounded-xl border border-white/10 bg-white/[0.04] px-3.5 py-2.5">
                        <span className="text-sm font-medium text-gray-200 truncate">{w.email}</span>
                        <span className="text-xs text-gray-500 shrink-0">{formatDate(w.joinedAt)}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </section>

          {/* Pending mentor applications */}
          {overview && (overview.pendingMentorApplications || 0) > 0 && (
            <div className="rounded-xl border border-amber-400/30 bg-amber-400/5 p-4 flex items-center justify-between gap-4">
              <p className="text-amber-300 text-sm">
                {overview.pendingMentorApplications} mentor application{overview.pendingMentorApplications === 1 ? '' : 's'} awaiting review.
              </p>
              <a href="#mentors" className="text-amber-300 text-sm font-semibold hover:underline shrink-0 focus-ring">Review below</a>
            </div>
          )}

          {/* Open complaints */}
          {complaints.filter(c => c.status === 'open').length > 0 && (
            <div className="rounded-xl border border-rose-400/30 bg-rose-400/5 p-4 flex items-center justify-between gap-4">
              <p className="flex items-center gap-2 text-rose-300 text-sm">
                <AlertTriangle className="h-4 w-4 shrink-0" />
                {complaints.filter(c => c.status === 'open').length} user escalation{complaints.filter(c => c.status === 'open').length === 1 ? '' : 's'} awaiting follow-up.
              </p>
              <a href="#complaints" className="text-rose-300 text-sm font-semibold hover:underline shrink-0 focus-ring">Resolve below</a>
            </div>
          )}

          {/* Users */}
          <Section title="All Users" subtitle="Including mentors and admins">
            <div className="overflow-x-auto -mx-5 px-5 sm:-mx-6 sm:px-6">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="text-gray-500 text-xs uppercase tracking-wide border-b border-white/10">
                    <th className="py-2.5 pr-4 font-semibold whitespace-nowrap">User</th>
                    <th className="py-2.5 pr-4 font-semibold whitespace-nowrap">Email</th>
                    <th className="py-2.5 pr-4 font-semibold whitespace-nowrap">Mentorship</th>
                    <th className="py-2.5 pr-4 font-semibold whitespace-nowrap">Role</th>
                    <th className="py-2.5 pr-4 font-semibold whitespace-nowrap">Joined</th>
                    <th className="py-2.5 font-semibold text-right whitespace-nowrap">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {users.map(u => (
                    <tr key={u.uid} className="border-b border-white/5">
                      <td className="py-3 pr-4 font-medium text-gray-200 whitespace-nowrap">{u.displayName || '—'}</td>
                      <td className="py-3 pr-4 text-gray-400 whitespace-nowrap">{u.email || '—'}</td>
                      <td className="py-3 pr-4">
                        {u.mentorshipInterest ? (
                          <>
                            <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-semibold uppercase ${u.mentorshipInterest.choice === 'yes' ? 'border border-[#84cc16]/40 bg-[#84cc16]/10 text-[#84cc16]' : 'border border-white/10 bg-white/5 text-gray-400'}`}>
                              {u.mentorshipInterest.choice === 'yes' ? 'Interested in paid mentorship' : 'Declined mentorship'}
                            </span>
                            {u.mentorshipInterest.opportunityTitle && (
                              <span className="block mt-1 text-gray-500 text-[11px] max-w-[220px] truncate">
                                {u.mentorshipInterest.opportunityTitle}
                              </span>
                            )}
                          </>
                        ) : (
                          <span className="text-gray-600 text-xs whitespace-nowrap">—</span>
                        )}
                      </td>
                      <td className="py-3 pr-4">
                        <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-semibold uppercase ${u.role === 'admin' ? 'border border-[#84cc16]/40 bg-[#84cc16]/10 text-[#84cc16]' : 'border border-white/10 bg-white/5 text-gray-400'}`}>
                          {u.role === 'admin' ? 'Admin' : 'User'}
                        </span>
                      </td>
                      <td className="py-3 pr-4 text-gray-500 text-xs whitespace-nowrap">{formatDate(u.createdAt)}</td>
                      <td className="py-3 text-right">
                        {u.role === 'admin' ? (
                          <span className="text-gray-600 text-xs whitespace-nowrap">—</span>
                        ) : (
                          <button
                            onClick={() => act(`users/${u.uid}/promote`, `${u.displayName || u.email || 'User'} promoted to admin.`)}
                            className="inline-flex items-center h-9 rounded-lg bg-[#84cc16]/10 text-[#84cc16] border border-[#84cc16]/30 text-xs font-semibold px-3 hover:bg-[#84cc16]/20 transition-all duration-200 active:scale-[0.97] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#84cc16]/60 focus-visible:ring-offset-2 focus-visible:ring-offset-[#070e0a]"
                          >
                            Make admin
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Section>

          {/* Mentors */}
          <div id="mentors">
            <Section title="Mentors" subtitle="Approved mentors, their mentee count, and account balance (90% of mentee payments).">
              <div className="overflow-x-auto -mx-5 px-5 sm:-mx-6 sm:px-6">
                <table className="w-full text-left text-sm">
                  <thead>
                    <tr className="text-gray-500 text-xs uppercase tracking-wide border-b border-white/10">
                      <th className="py-2.5 pr-4 font-semibold whitespace-nowrap">Mentor</th>
                      <th className="py-2.5 pr-4 font-semibold whitespace-nowrap">Industry / Company</th>
                      <th className="py-2.5 pr-4 font-semibold whitespace-nowrap">Status</th>
                      <th className="py-2.5 pr-4 font-semibold whitespace-nowrap">Mentees</th>
                      <th className="py-2.5 pr-4 font-semibold whitespace-nowrap">Account Balance</th>
                      <th className="py-2.5 font-semibold text-right whitespace-nowrap">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {mentors.map(m => (
                      <tr key={m.userId} className="border-b border-white/5">
                        <td className="py-3 pr-4 whitespace-nowrap">
                          <p className="font-medium text-gray-200">{m.name || '—'}</p>
                          {m.email && <p className="text-gray-500 text-xs">{m.email}</p>}
                        </td>
                        <td className="py-3 pr-4 text-gray-400 text-xs">
                          <p className="text-gray-300 text-sm whitespace-nowrap">{m.roleType}</p>
                          <p>{m.company}</p>
                        </td>
                        <td className="py-3 pr-4">
                          <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-semibold uppercase ${statusBadge(m.status)}`}>
                            {m.status}
                          </span>
                        </td>
                        <td className="py-3 pr-4 text-gray-200 whitespace-nowrap tabular-nums">{m.menteesCount}</td>
                        <td className="py-3 pr-4 text-[#84cc16] font-semibold tabular-nums whitespace-nowrap">{formatMoney(m.accountBalance)}</td>
                        <td className="py-3 text-right">
                          {m.status === 'pending' ? (
                            <div className="flex gap-2 justify-end">
                              <button
                                onClick={() => act(`mentors/${m.userId}/approve`, `${m.name || 'Mentor'} approved.`)}
                                className="inline-flex items-center gap-1 h-9 rounded-lg bg-[#84cc16]/10 text-[#84cc16] border border-[#84cc16]/30 text-xs font-semibold px-3 hover:bg-[#84cc16]/20 transition-all duration-200 active:scale-[0.97] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#84cc16]/60 focus-visible:ring-offset-2 focus-visible:ring-offset-[#070e0a]"
                              >
                                <CheckCircle2 className="h-3.5 w-3.5" /> Approve
                              </button>
                              <button
                                onClick={() => act(`mentors/${m.userId}/reject`, `${m.name || 'Mentor'} application rejected.`)}
                                className="inline-flex items-center gap-1 h-9 rounded-lg bg-rose-400/10 text-rose-300 border border-rose-400/30 text-xs font-semibold px-3 hover:bg-rose-400/20 transition-all duration-200 active:scale-[0.97] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-400/60 focus-visible:ring-offset-2 focus-visible:ring-offset-[#070e0a]"
                              >
                                <XCircle className="h-3.5 w-3.5" /> Reject
                              </button>
                            </div>
                          ) : (
                            <span className="text-gray-600 text-xs whitespace-nowrap">—</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Section>
          </div>

          {/* Mentees */}
          <Section title="Mentees & Payments" subtitle="Every paid mentorship request with the platform's 10% share and the mentor's 90% share.">
            <div className="overflow-x-auto -mx-5 px-5 sm:-mx-6 sm:px-6">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="text-gray-500 text-xs uppercase tracking-wide border-b border-white/10">
                    <th className="py-2.5 pr-4 font-semibold whitespace-nowrap">Student</th>
                    <th className="py-2.5 pr-4 font-semibold whitespace-nowrap">Opportunity</th>
                    <th className="py-2.5 pr-4 font-semibold whitespace-nowrap">Mentor</th>
                    <th className="py-2.5 pr-4 font-semibold whitespace-nowrap">Paid</th>
                    <th className="py-2.5 pr-4 font-semibold whitespace-nowrap">Platform 10%</th>
                    <th className="py-2.5 pr-4 font-semibold whitespace-nowrap">Mentor 90%</th>
                    <th className="py-2.5 font-semibold whitespace-nowrap">Date</th>
                  </tr>
                </thead>
                <tbody>
                  {mentees.map(e => (
                    <tr key={e.id} className="border-b border-white/5">
                      <td className="py-3 pr-4 whitespace-nowrap">
                        <p className="text-gray-200 font-medium">{e.userName || '—'}</p>
                        {e.userEmail && <p className="text-gray-500 text-xs">{e.userEmail}</p>}
                      </td>
                      <td className="py-3 pr-4">
                        <p className="text-gray-200 max-w-[240px] truncate">{e.opportunityTitle || '—'}</p>
                        {e.opportunityType && <p className="text-gray-500 text-xs">{e.opportunityType}</p>}
                      </td>
                      <td className="py-3 pr-4 text-gray-400 whitespace-nowrap">{e.mentorName || 'Unassigned'}</td>
                      <td className="py-3 pr-4 text-[#84cc16] font-semibold tabular-nums whitespace-nowrap">{formatMoney(e.amount, e.currency)}</td>
                      <td className="py-3 pr-4 text-gray-300 tabular-nums whitespace-nowrap">{formatMoney(e.platformCut, e.currency)}</td>
                      <td className="py-3 pr-4 text-gray-300 tabular-nums whitespace-nowrap">{formatMoney(e.mentorCut, e.currency)}</td>
                      <td className="py-3 text-gray-500 text-xs whitespace-nowrap">{formatDate(e.createdAt)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Section>

          {/* Complaints / escalations */}
          <div id="complaints">
            <Section title="Escalations" subtitle="Messages a user sent in the chat about a payment or a missing mentor, forwarded straight to admins.">
              {complaints.length === 0 ? (
                <p className="text-gray-400 text-sm">No escalations yet.</p>
              ) : (
                <div className="space-y-3">
                  {complaints.map(c => (
                    <div
                      key={c.id}
                      className={`rounded-xl border p-4 ${c.status === 'open' ? 'border-rose-400/30 bg-rose-400/5' : 'border-white/10 bg-white/[0.02]'}`}
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-gray-200 text-sm">{c.ticket}</span>
                          <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-semibold uppercase ${c.status === 'open' ? 'border border-rose-400/40 bg-rose-400/10 text-rose-300' : 'border border-emerald-400/40 bg-emerald-400/10 text-emerald-300'}`}>
                            {c.status}
                          </span>
                        </div>
                        <span className="text-gray-500 text-xs">{formatDate(c.createdAt)}</span>
                      </div>
                      <p className="text-gray-300 text-sm leading-relaxed mb-3">{c.message}</p>
                      <div className="flex flex-wrap items-center gap-2 text-[11px] text-gray-400">
                        <span className="inline-flex items-center gap-1 rounded-full border border-white/10 bg-white/[0.05] px-2.5 py-0.5">
                          <Users className="h-3 w-3" /> {c.userName || 'Anonymous'}
                        </span>
                        <span className="inline-flex rounded-full border border-white/10 bg-white/[0.05] px-2.5 py-0.5">{c.userEmail || 'no email'}</span>
                        <span className="inline-flex rounded-full border border-white/10 bg-white/[0.05] px-2.5 py-0.5">uid: {c.userId || '—'}</span>
                        {c.payments && c.payments.length > 0 && (
                          <span className="inline-flex items-center gap-1 rounded-full border border-[#84cc16]/40 bg-[#84cc16]/10 px-2.5 py-0.5 text-[#84cc16]">
                            <Wallet className="h-3 w-3" /> {c.payments.length} paid record{c.payments.length === 1 ? '' : 's'}
                          </span>
                        )}
                      </div>
                      {c.payments && c.payments.length > 0 && (
                        <div className="mt-2 flex flex-wrap gap-2 text-[10px] text-gray-500">
                          {c.payments.map(p => (
                            <span key={p.reference} className="rounded-lg border border-white/10 bg-white/[0.03] px-2 py-0.5">
                              {p.reference} · {formatMoney(p.amount, p.currency)}{p.mentorName ? ` → ${p.mentorName}` : ' · no mentor assigned'}
                            </span>
                          ))}
                        </div>
                      )}
                      {c.status === 'open' && (
                        <button
                          onClick={() => act(`complaints/${c.id}/resolve`, `${c.ticket} marked as resolved.`)}
                          className="mt-3 inline-flex items-center gap-1.5 rounded-lg bg-emerald-400/10 text-emerald-300 border border-emerald-400/30 text-xs font-semibold px-3 py-2 hover:bg-emerald-400/20 transition-all duration-200 active:scale-[0.97] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400/60 focus-visible:ring-offset-2 focus-visible:ring-offset-[#070e0a]"
                        >
                          <CheckCircle2 className="h-3.5 w-3.5" /> Mark resolved
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </Section>
          </div>
        </div>
      )}
    </div>
  );
}

function Stat({ icon, label, value, sub }: { icon: React.ReactNode; label: string; value: string; sub?: string }) {
  return (
    <div className="card-surface p-5 min-w-0">
      <span className="p-2 rounded-lg bg-[#84cc16]/10 border border-[#84cc16]/20 text-[#84cc16] inline-flex mb-2">{icon}</span>
      <p className="text-2xl font-extrabold text-white tabular-nums">{value}</p>
      <p className="text-gray-400 text-xs mt-1">{sub ? `${label} · ${sub}` : label}</p>
    </div>
  );
}

function Section({ title, subtitle, children }: { title: string; subtitle?: string; children: React.ReactNode }) {
  return (
    <div className="card-surface p-5 sm:p-6">
      <div className="mb-4">
        <h2 className="flex items-center gap-2 text-sm font-bold text-white uppercase tracking-wide">{title}</h2>
        {subtitle && <p className="text-gray-500 text-xs mt-0.5">{subtitle}</p>}
      </div>
      {children}
    </div>
  );
}
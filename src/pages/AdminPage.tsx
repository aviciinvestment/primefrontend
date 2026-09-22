import { useEffect, useState, useCallback } from 'react';
import {
  Activity,
  AlertTriangle,
  BarChart3,
  CheckCircle2,
  Eye,
  EyeOff,
  Handshake,
  Link2,
  PlusCircle,
  RefreshCw,
  Rocket,
  ShieldBan,
  ShieldCheck,
  Timer,
  Users,
  Wallet,
  XCircle,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { BreathingLoader } from '../components/BreathingLoader';
import { API_BASE, isAdminPreviewEnabled, setAdminPreviewEnabled } from '../lib/applications';
import { apiFetch } from '../lib/api';

const formatMoney = (amount: number, currency: string = 'NGN') =>
  new Intl.NumberFormat('en-NG', { style: 'currency', currency }).format(amount);

const formatCount = (n?: number) => (typeof n === 'number' ? n.toLocaleString('en-US') : '—');

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
interface VisitStats {
  totalVisits: number; uniqueVisitors: number; visitsToday: number; uniqueToday: number;
  daily: Array<{ date: string; visits: number; unique: number }>;
}
interface ComplaintRow {
  id: string; ticket: string; userId?: string; userEmail?: string; userName?: string;
  message: string; status: 'open' | 'resolved';
  createdAt: string;
  payments: Array<{ reference: string; amount: number; currency: string; mentorName: string; createdAt: string }>;
}
interface ChatLogRow {
  _id: string; userId?: string; userEmail?: string; userName?: string;
  message: string; reply: string; source: 'server' | 'worker';
  createdAt: string;
}

interface AddOpportunityForm {
  title: string; organization: string; officialUrl: string; description: string;
  category: string; opportunityType: string; location: string; deadline: string;
  fundingAmount: string; currency: string; eligibleEducationLevels: string;
  eligibleFields: string; tags: string;
}

const EMPTY_ADD_FORM: AddOpportunityForm = {
  title: '', organization: '', officialUrl: '', description: '',
  category: '', opportunityType: '', location: '', deadline: '',
  fundingAmount: '', currency: '', eligibleEducationLevels: '', eligibleFields: '', tags: '',
};

const statusBadge = (status: string) =>
  status === 'approved' ? 'border border-emerald-400/40 bg-emerald-400/10 text-emerald-300'
  : status === 'pending' ? 'border border-amber-400/40 bg-amber-400/10 text-amber-300'
  : 'border border-rose-400/40 bg-rose-400/10 text-rose-300';

export default function AdminPage() {
  const { user, isAdmin, role } = useAuth();

  const [overview, setOverview] = useState<Overview | null>(null);
  const [visits, setVisits] = useState<VisitStats | null>(null);
  const [users, setUsers] = useState<AppUserRow[]>([]);
  const [mentors, setMentors] = useState<MentorRow[]>([]);
  const [mentees, setMentees] = useState<MenteeRow[]>([]);
  const [complaints, setComplaints] = useState<ComplaintRow[]>([]);
  const [chats, setChats] = useState<ChatLogRow[]>([]);
  const [launch, setLaunch] = useState<LaunchAdmin | null>(null);
  // Server-side pagination for the three big list tabs (B-05): the server now
  // returns page/page-size slices + total/page count instead of the whole table.
  const [usersPg, setUsersPg] = useState({ page: 1, pages: 1 });
  const [mentorsPg, setMentorsPg] = useState({ page: 1, pages: 1 });
  const [menteesPg, setMenteesPg] = useState({ page: 1, pages: 1 });
  const [chatsPg, setChatsPg] = useState({ page: 1, pages: 1 });
  const [tabLoading, setTabLoading] = useState<'' | 'users' | 'mentors' | 'mentees' | 'chats'>('');
  const [timerInput, setTimerInput] = useState('5');
  const [waInput, setWaInput] = useState('');
  const [launchBusy, setLaunchBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [notice, setNotice] = useState('');
  const [adminPreview, setAdminPreview] = useState(() => isAdminPreviewEnabled());

  // Opportunity ingestion: manual sync trigger + manual add form.
  const [syncBusy, setSyncBusy] = useState(false);
  const [ingestNotice, setIngestNotice] = useState('');
  const [addOpen, setAddOpen] = useState(false);
  const [addBusy, setAddBusy] = useState(false);
  const [addForm, setAddForm] = useState<AddOpportunityForm>(EMPTY_ADD_FORM);

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
      // Each endpoint is fetched independently: if one is missing/errors (e.g.
      // a section the backend version doesn't expose yet), the others still load
      // instead of the whole page blanking on a Promise.all rejection.
      const tryGet = async (path: string): Promise<any> => {
        try {
          return await apiFetch(`${API_BASE}${path}`).then(r => r.json());
        } catch {
          return {};
        }
      };
      const [o, u, m, e, c, l, ch, v] = await Promise.all([
        tryGet('/admin/overview'),
        tryGet('/admin/users'),
        tryGet('/admin/mentors'),
        tryGet('/admin/mentees'),
        tryGet('/admin/complaints'),
        tryGet('/admin/launch'),
        tryGet('/admin/chats'),
        tryGet('/admin/visits'),
      ]);
      if (o.success) setOverview(o);
      if (v.success) setVisits(v);
      if (u.success) {
        setUsers(u.users);
        setUsersPg({ page: u.page || 1, pages: u.pages || 1 });
      }
      if (m.success) {
        setMentors(m.mentors);
        setMentorsPg({ page: m.page || 1, pages: m.pages || 1 });
      }
      if (e.success) {
        setMentees(e.mentees);
        setMenteesPg({ page: e.page || 1, pages: e.pages || 1 });
      }
      if (c.success) setComplaints(c.complaints);
      if (ch.success) {
        setChats(ch.chats || []);
        setChatsPg({ page: ch.page || 1, pages: ch.pages || 1 });
      }
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

  const loadMoreTab = async (tab: 'users' | 'mentors' | 'mentees') => {
    if (!user || tabLoading) return;
    const nextPage =
      tab === 'users' ? usersPg.page + 1
      : tab === 'mentors' ? mentorsPg.page + 1
      : menteesPg.page + 1;
    setTabLoading(tab);
    try {
      const res = await apiFetch(`${API_BASE}/admin/${tab}?page=${nextPage}`);
      const data = await res.json();
      if (!data.success) return;
      if (tab === 'users') {
        setUsers(prev => [...prev, ...(data.users || [])]);
        setUsersPg({ page: nextPage, pages: data.pages || nextPage });
      } else if (tab === 'mentors') {
        setMentors(prev => [...prev, ...(data.mentors || [])]);
        setMentorsPg({ page: nextPage, pages: data.pages || nextPage });
      } else {
        setMentees(prev => [...prev, ...(data.mentees || [])]);
        setMenteesPg({ page: nextPage, pages: data.pages || nextPage });
      }
} catch {
        // Keep the list as-is; the button stays available to retry.
      } finally {
        setTabLoading('');
      }
  };

  const loadMoreChats = async () => {
    if (!user || tabLoading) return;
    const nextPage = chatsPg.page + 1;
    setTabLoading('chats');
    try {
      const res = await apiFetch(`${API_BASE}/admin/chats?page=${nextPage}`);
      const data = await res.json();
      if (!data.success) return;
      setChats(prev => [...prev, ...(data.chats || [])]);
      setChatsPg({ page: nextPage, pages: data.pages || nextPage });
    } catch {
      // Keep the list as-is; the button stays available to retry.
    } finally {
      setTabLoading('');
    }
  };

  // Keep Chat Activity fresh: admins usually leave this page open while testing
  // the chat widget, and chats load only on mount — so refetch the newest page
  // whenever the admin refocuses the tab.
  const refreshChats = useCallback(async () => {
    try {
      const res = await apiFetch(`${API_BASE}/admin/chats`);
      const data = await res.json();
      if (!data.success) return;
      setChats(data.chats || []);
      setChatsPg({ page: data.page || 1, pages: data.pages || 1 });
    } catch {
      // Keep the current list on transient failures.
    }
  }, [user]);

  useEffect(() => {
    if (!user) return;
    const onFocus = () => { void refreshChats(); };
    window.addEventListener('focus', onFocus);
    return () => window.removeEventListener('focus', onFocus);
  }, [user, refreshChats]);

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

  // Two manual upload means for opportunities: (1) run the source sync now,
  // and (2) add a single opportunity by hand through the form below.
  const handleSyncNow = async () => {
    if (!user || syncBusy) return;
    setSyncBusy(true);
    setIngestNotice('');
    try {
      const res = await apiFetch(`${API_BASE}/sync/run`, { method: 'POST' });
      const data = await res.json();
      if (data.success) {
        const r = data.result || {};
        setIngestNotice(`Sync complete — ${r.inserted ?? 0} new, ${r.updated ?? 0} updated, ${r.closed ?? 0} closed${r.durationMs ? ` (${r.durationMs}ms)` : ''}.`);
      } else {
        setIngestNotice(data.error || data.message || 'Sync failed.');
      }
    } catch {
      setIngestNotice('Sync failed — network error.');
    } finally {
      setSyncBusy(false);
    }
  };

  const setAddField = (key: keyof AddOpportunityForm) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
      setAddForm(prev => ({ ...prev, [key]: e.target.value }));

  const handleAddOpportunity = async () => {
    if (!user || addBusy) return;
    if (!addForm.title.trim() || !addForm.organization.trim() || !addForm.officialUrl.trim() || !addForm.description.trim()) {
      setIngestNotice('Title, organization, description, and a valid URL are required.');
      return;
    }
    setAddBusy(true);
    setIngestNotice('');
    try {
      const res = await apiFetch(`${API_BASE}/opportunities`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: addForm.title.trim(),
          organization: addForm.organization.trim(),
          officialUrl: addForm.officialUrl.trim(),
          description: addForm.description.trim(),
          category: addForm.category.trim(),
          opportunityType: addForm.opportunityType.trim(),
          location: addForm.location.trim(),
          deadline: addForm.deadline?.trim() || undefined,
          fundingAmount: addForm.fundingAmount.trim() || undefined,
          currency: addForm.currency.trim() || undefined,
          eligibleEducationLevels: addForm.eligibleEducationLevels.trim(),
          eligibleFields: addForm.eligibleFields.trim(),
          tags: addForm.tags.trim(),
          status: 'OPEN',
        }),
      });
      const data = await res.json();
      if (data.success) {
        setIngestNotice(`Opportunity created: ${data.data.title}.`);
        setAddForm(EMPTY_ADD_FORM);
        setAddOpen(false);
      } else {
        setIngestNotice(data.error || data.message || 'Could not create the opportunity.');
      }
    } catch {
      setIngestNotice('Failed to create the opportunity.');
    } finally {
      setAddBusy(false);
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
          <BreathingLoader size="md" dots={3} label="Loading…" />
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

          {/* Visitors — how many people opened the app */}
          <VisitorsSection visits={visits} />

          {/* Opportunity ingestion */}
          <Section
            title="Opportunities"
            subtitle="Manually add a single opportunity or pull fresh listings from the connected sources with one click."
          >
            <div className="flex flex-wrap items-center gap-3 mb-4">
              <button
                onClick={handleSyncNow}
                disabled={syncBusy}
                className="inline-flex flex-1 items-center justify-center gap-1.5 h-10 rounded-xl bg-[#84cc16]/10 text-[#84cc16] border border-[#84cc16]/30 text-xs font-semibold px-3.5 hover:bg-[#84cc16]/20 transition-all duration-200 active:scale-[0.97] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#84cc16]/60 focus-visible:ring-offset-2 focus-visible:ring-offset-[#070e0a] btn-busy disabled:pointer-events-none disabled:opacity-60 sm:flex-none"
              >
                {syncBusy ? <BreathingLoader size="sm" dots={3} /> : <RefreshCw className="h-3.5 w-3.5" />}
                {syncBusy ? 'Syncing…' : 'Sync Now'}
              </button>
              <button
                onClick={() => setAddOpen(v => !v)}
                disabled={addBusy}
                className="inline-flex flex-1 items-center justify-center gap-1.5 h-10 rounded-xl bg-[#84cc16]/10 text-[#84cc16] border border-[#84cc16]/30 text-xs font-semibold px-3.5 hover:bg-[#84cc16]/20 transition-all duration-200 active:scale-[0.97] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#84cc16]/60 focus-visible:ring-offset-2 focus-visible:ring-offset-[#070e0a] disabled:pointer-events-none disabled:opacity-60 sm:flex-none"
              >
                <PlusCircle className="h-3.5 w-3.5" />
                {addOpen ? 'Close form' : 'Add Opportunity'}
              </button>
            </div>

            {ingestNotice && (
              <div className={`rounded-lg border px-3.5 py-2.5 text-sm mb-4 ${ingestNotice.includes('required') || ingestNotice.includes('already exists') || ingestNotice.includes('Failed') || ingestNotice.includes('Could not') ? 'border-rose-400/30 bg-rose-400/10 text-rose-300' : 'border-[#84cc16]/30 bg-[#84cc16]/10 text-[#84cc16]'}`}>
                {ingestNotice}
              </div>
            )}

            {addOpen && (
              <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4 space-y-3 animate-in fade-in duration-200">
                <div className="grid sm:grid-cols-2 gap-3">
                  <input value={addForm.title} onChange={setAddField('title')} placeholder="Title *" className="input-base" />
                  <input value={addForm.organization} onChange={setAddField('organization')} placeholder="Organization *" className="input-base" />
                </div>
                <input value={addForm.officialUrl} onChange={setAddField('officialUrl')} placeholder="Official URL * (https://…)" className="input-base" />
                <textarea value={addForm.description} onChange={setAddField('description')} rows={3} placeholder="Description *" className="input-base resize-none" />
                <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  <input value={addForm.category} onChange={setAddField('category')} placeholder="Category (e.g. Category A - Undergraduate)" className="input-base" />
                  <input value={addForm.opportunityType} onChange={setAddField('opportunityType')} placeholder="Type (Scholarship, Internship…)" className="input-base" />
                  <input value={addForm.location} onChange={setAddField('location')} placeholder="Location" className="input-base" />
                  <input type="date" value={addForm.deadline} onChange={setAddField('deadline')} className="input-base" />
                  <input value={addForm.fundingAmount} onChange={setAddField('fundingAmount')} placeholder="Funding amount" className="input-base" />
                  <input value={addForm.currency} onChange={setAddField('currency')} placeholder="Currency (NGN, USD…)" className="input-base" />
                  <input value={addForm.eligibleEducationLevels} onChange={setAddField('eligibleEducationLevels')} placeholder="Levels (comma-separated)" className="input-base" />
                  <input value={addForm.eligibleFields} onChange={setAddField('eligibleFields')} placeholder="Fields (comma-separated)" className="input-base" />
                  <input value={addForm.tags} onChange={setAddField('tags')} placeholder="Tags (comma-separated)" className="input-base" />
                </div>
                <div className="flex items-center justify-between gap-3 flex-wrap">
                  <p className="text-xs text-gray-500">Required: title, organization, description, and official URL.</p>
                  <button
                    onClick={handleAddOpportunity}
                    disabled={addBusy}
                    className="inline-flex items-center gap-1.5 h-10 rounded-xl bg-[#84cc16] text-[#070e0a] text-xs font-bold px-4 transition-all duration-200 active:scale-[0.97] hover:brightness-110 btn-busy disabled:pointer-events-none disabled:opacity-60"
                  >
                    {addBusy ? <><BreathingLoader size="sm" dots={3} tone="dark" /> Creating…</> : <><PlusCircle className="h-3.5 w-3.5" /> Create opportunity</>}
                  </button>
                </div>
              </div>
            )}
          </Section>

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
                  <div className="flex gap-2 items-center flex-wrap">
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
                  <div className="flex items-center justify-between gap-2.5 flex-wrap">
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
              <table className="table-responsive w-full text-left text-sm">
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
                      <td data-label="User" className="py-3 pr-4 font-medium text-gray-200 whitespace-nowrap">{u.displayName || '—'}</td>
                      <td data-label="Email" className="py-3 pr-4 text-gray-400 whitespace-nowrap">{u.email || '—'}</td>
                      <td data-label="Mentorship" className="py-3 pr-4">
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
                      <td data-label="Role" className="py-3 pr-4">
                        <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-semibold uppercase ${u.role === 'admin' ? 'border border-[#84cc16]/40 bg-[#84cc16]/10 text-[#84cc16]' : 'border border-white/10 bg-white/5 text-gray-400'}`}>
                          {u.role === 'admin' ? 'Admin' : 'User'}
                        </span>
                      </td>
                      <td data-label="Joined" className="py-3 pr-4 text-gray-500 text-xs whitespace-nowrap">{formatDate(u.createdAt)}</td>
                      <td data-label="Action" className="py-3 text-right">
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
            {usersPg.page < usersPg.pages && (
              <div className="mt-4 flex justify-center">
                <button
                  onClick={() => loadMoreTab('users')}
                  disabled={tabLoading === 'users'}
                  className="inline-flex items-center gap-1.5 h-10 rounded-xl bg-[#84cc16]/10 text-[#84cc16] border border-[#84cc16]/30 text-xs font-semibold px-4 hover:bg-[#84cc16]/20 transition-all duration-200 active:scale-[0.97] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#84cc16]/60 focus-visible:ring-offset-2 focus-visible:ring-offset-[#070e0a] disabled:pointer-events-none disabled:opacity-60"
                >
                  {tabLoading === 'users' ? <BreathingLoader size="sm" dots={3} /> : <RefreshCw className="h-3.5 w-3.5" />}
                  Load more users ({users.length} shown)
                </button>
              </div>
            )}
          </Section>

          {/* Mentors */}
          <div id="mentors">
            <Section title="Mentors" subtitle="Approved mentors, their mentee count, and account balance (90% of mentee payments).">
              <div className="overflow-x-auto -mx-5 px-5 sm:-mx-6 sm:px-6">
                <table className="table-responsive w-full text-left text-sm">
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
                        <td data-label="Mentor" className="py-3 pr-4 whitespace-nowrap">
                          <p className="font-medium text-gray-200">{m.name || '—'}</p>
                          {m.email && <p className="text-gray-500 text-xs">{m.email}</p>}
                        </td>
                        <td data-label="Industry / Company" className="py-3 pr-4 text-gray-400 text-xs">
                          <p className="text-gray-300 text-sm whitespace-nowrap">{m.roleType}</p>
                          <p>{m.company}</p>
                        </td>
                        <td data-label="Status" className="py-3 pr-4">
                          <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-semibold uppercase ${statusBadge(m.status)}`}>
                            {m.status}
                          </span>
                        </td>
                        <td data-label="Mentees" className="py-3 pr-4 text-gray-200 whitespace-nowrap tabular-nums">{m.menteesCount}</td>
                        <td data-label="Account Balance" className="py-3 pr-4 text-[#84cc16] font-semibold tabular-nums whitespace-nowrap">{formatMoney(m.accountBalance)}</td>
                        <td data-label="Action" className="py-3 text-right">
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
              {mentorsPg.page < mentorsPg.pages && (
                <div className="mt-4 flex justify-center">
                  <button
                    onClick={() => loadMoreTab('mentors')}
                    disabled={tabLoading === 'mentors'}
                    className="inline-flex items-center gap-1.5 h-10 rounded-xl bg-[#84cc16]/10 text-[#84cc16] border border-[#84cc16]/30 text-xs font-semibold px-4 hover:bg-[#84cc16]/20 transition-all duration-200 active:scale-[0.97] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#84cc16]/60 focus-visible:ring-offset-2 focus-visible:ring-offset-[#070e0a] disabled:pointer-events-none disabled:opacity-60"
                  >
                    {tabLoading === 'mentors' ? <BreathingLoader size="sm" dots={3} /> : <RefreshCw className="h-3.5 w-3.5" />}
                    Load more mentors ({mentors.length} shown)
                  </button>
                </div>
              )}
            </Section>
          </div>

          {/* Mentees */}
          <Section title="Mentees & Payments" subtitle="Every paid mentorship request with the platform's 10% share and the mentor's 90% share.">
            <div className="overflow-x-auto -mx-5 px-5 sm:-mx-6 sm:px-6">
              <table className="table-responsive w-full text-left text-sm">
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
                      <td data-label="Student" className="py-3 pr-4 whitespace-nowrap">
                        <p className="text-gray-200 font-medium">{e.userName || '—'}</p>
                        {e.userEmail && <p className="text-gray-500 text-xs">{e.userEmail}</p>}
                      </td>
                      <td data-label="Opportunity" className="py-3 pr-4">
                        <p className="text-gray-200 max-w-[240px] truncate">{e.opportunityTitle || '—'}</p>
                        {e.opportunityType && <p className="text-gray-500 text-xs">{e.opportunityType}</p>}
                      </td>
                      <td data-label="Mentor" className="py-3 pr-4 text-gray-400 whitespace-nowrap">{e.mentorName || 'Unassigned'}</td>
                      <td data-label="Paid" className="py-3 pr-4 text-[#84cc16] font-semibold tabular-nums whitespace-nowrap">{formatMoney(e.amount, e.currency)}</td>
                      <td data-label="Platform 10%" className="py-3 pr-4 text-gray-300 tabular-nums whitespace-nowrap">{formatMoney(e.platformCut, e.currency)}</td>
                      <td data-label="Mentor 90%" className="py-3 pr-4 text-gray-300 tabular-nums whitespace-nowrap">{formatMoney(e.mentorCut, e.currency)}</td>
                      <td data-label="Date" className="py-3 text-gray-500 text-xs whitespace-nowrap">{formatDate(e.createdAt)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {menteesPg.page < menteesPg.pages && (
              <div className="mt-4 flex justify-center">
                <button
                  onClick={() => loadMoreTab('mentees')}
                  disabled={tabLoading === 'mentees'}
                  className="inline-flex items-center gap-1.5 h-10 rounded-xl bg-[#84cc16]/10 text-[#84cc16] border border-[#84cc16]/30 text-xs font-semibold px-4 hover:bg-[#84cc16]/20 transition-all duration-200 active:scale-[0.97] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#84cc16]/60 focus-visible:ring-offset-2 focus-visible:ring-offset-[#070e0a] disabled:pointer-events-none disabled:opacity-60"
                >
                  {tabLoading === 'mentees' ? <BreathingLoader size="sm" dots={3} /> : <RefreshCw className="h-3.5 w-3.5" />}
                  Load more mentees ({mentees.length} shown)
                </button>
              </div>
            )}
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

          {/* Chat activity */}
          <div id="chats">
            <Section title="Chat Activity" subtitle="Every exchange the AI assistant had with a member — the exact message sent and the reply received. Newest first.">
              {chats.length === 0 ? (
                <p className="text-gray-400 text-sm">No chat messages yet.</p>
              ) : (
                <div className="space-y-3">
                  {chats.map(ch => (
                    <div
                      key={ch._id}
                      className={`rounded-xl border p-4 ${ch.source === 'worker' ? 'border-indigo-400/30 bg-indigo-400/5' : 'border-white/10 bg-white/[0.02]'}`}
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-gray-200 text-sm">
                            {ch.userName || ch.userEmail || 'Anonymous'}
                          </span>
                          <span className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-semibold uppercase border border-white/10 bg-white/[0.05] text-gray-300">
                            {ch.source === 'worker' ? 'Worker' : 'API'}
                          </span>
                        </div>
                        <span className="text-gray-500 text-xs">{formatDate(ch.createdAt)}</span>
                      </div>
                      <div className="space-y-2">
                        <div className="rounded-lg border border-white/10 bg-white/[0.03] p-3">
                          <p className="text-[10px] uppercase tracking-wider text-gray-500 mb-1">User</p>
                          <p className="text-gray-300 text-sm leading-relaxed whitespace-pre-wrap break-words">{ch.message}</p>
                        </div>
                        <div className="rounded-lg border border-[#84cc16]/20 bg-[#84cc16]/5 p-3">
                          <p className="text-[10px] uppercase tracking-wider text-[#84cc16]/70 mb-1">Assistant</p>
                          <p className="text-gray-300 text-sm leading-relaxed whitespace-pre-wrap break-words">{ch.reply}</p>
                        </div>
                      </div>
                      {ch.userId && (
                        <p className="mt-2 text-[11px] text-gray-500">uid: {ch.userId}</p>
                      )}
                    </div>
                  ))}
                </div>
              )}
              {chatsPg.page < chatsPg.pages && (
                <div className="mt-4 flex justify-center">
                  <button
                    onClick={loadMoreChats}
                    disabled={tabLoading === 'chats'}
                    className="inline-flex items-center gap-1.5 h-10 rounded-xl bg-[#84cc16]/10 text-[#84cc16] border border-[#84cc16]/30 text-xs font-semibold px-4 hover:bg-[#84cc16]/20 transition-all duration-200 active:scale-[0.97] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#84cc16]/60 focus-visible:ring-offset-2 focus-visible:ring-offset-[#070e0a] disabled:pointer-events-none disabled:opacity-60"
                  >
                    {tabLoading === 'chats' ? <BreathingLoader size="sm" dots={3} /> : <RefreshCw className="h-3.5 w-3.5" />}
                    Load more chats ({chats.length} shown)
                  </button>
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

// Visitors — the site-visitor dashboard the /api/admin/visits endpoint feeds.
// Shows lifetime totals, today's activity, and a zero-filled 14-day bar chart.
function VisitorsSection({ visits }: { visits: VisitStats | null }) {
  const daily = visits?.daily ?? [];
  const total14 = daily.reduce((sum, d) => sum + d.visits, 0);
  const last7 = daily.slice(-7);
  const avg7 = last7.length ? Math.round(last7.reduce((s, d) => s + d.visits, 0) / last7.length) : 0;
  const maxVisits = Math.max(1, ...daily.map(d => d.visits));

  return (
    <Section
      title="Visitors"
      subtitle="Every app session — total, unique visitors, today, and the last 14 days."
    >
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 mb-5">
        <Stat icon={<Eye className="h-5 w-5" />} label="Total Visits" value={formatCount(visits?.totalVisits)} />
        <Stat icon={<Users className="h-5 w-5" />} label="Unique Visitors" value={formatCount(visits?.uniqueVisitors)} />
        <Stat icon={<Activity className="h-5 w-5" />} label="Visits Today" value={formatCount(visits?.visitsToday)} />
        <Stat icon={<Timer className="h-5 w-5" />} label="Unique Today" value={formatCount(visits?.uniqueToday)} />
      </div>

      <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
        <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
          <p className="text-[10px] uppercase tracking-wider text-gray-500 flex items-center gap-1.5">
            <BarChart3 className="h-3.5 w-3.5" /> Last 14 days — visits
          </p>
          <p className="text-xs text-gray-400">
            {formatCount(total14)} total · {formatCount(avg7)}/day avg (7d)
          </p>
        </div>
        <div className="flex items-end gap-1 sm:gap-1.5 h-32">
          {daily.map(d => (
            <div
              key={d.date}
              className="flex flex-1 flex-col justify-end min-w-0 h-full cursor-default"
              title={`${d.date}: ${d.visits} visit${d.visits === 1 ? '' : 's'}, ${d.unique} unique`}
            >
              <div
                className="w-full rounded-md bg-[#84cc16]/70 hover:bg-[#a3e635]/90 transition-colors"
                style={{ height: `${Math.max(4, Math.round((d.visits / maxVisits) * 100))}%` }}
              />
            </div>
          ))}
        </div>
        <div className="flex gap-1 sm:gap-1.5 mt-1.5">
          {daily.map(d => (
            <div key={d.date} className="flex-1 min-w-0 text-center">
              <span className="text-[9px] text-gray-600">{d.date.slice(5)}</span>
            </div>
          ))}
        </div>
      </div>

      {(!visits || visits.totalVisits === 0) && (
        <p className="text-xs text-gray-500 mt-3">
          No visits recorded yet — the tracker starts counting the moment someone opens the app.
        </p>
      )}
    </Section>
  );
}
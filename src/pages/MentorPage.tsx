import { useEffect, useState } from 'react';
import {
  CheckCircle2,
  Clock,
  Handshake,
  Loader2,
  MessageCircle,
  UserPlus,
  Users,
  Wallet,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { API_BASE } from '../lib/applications';

const ROLE_OPTIONS = [
  'Technology',
  'Finance',
  'Engineering',
  'Healthcare',
  'Business / Consulting',
  'Education',
  'Law',
  'Media & Communications',
  'Design / Creative',
  'Energy / Oil & Gas',
  'Agriculture',
  'Other',
];

interface MentorProfile {
  userId: string;
  name: string;
  email: string;
  company: string;
  roleType: string;
  careerStory: string;
  status: 'pending' | 'approved' | 'rejected';
  createdAt: string;
}

interface MenteeRequest {
  _id: string;
  userName?: string;
  userEmail?: string;
  opportunityTitle?: string;
  opportunityOrg?: string;
  opportunityType?: string;
  amount: number;
  currency: string;
  mentorName?: string;
  createdAt: string;
}

const formatMoney = (amount: number, currency: string = 'NGN') =>
  new Intl.NumberFormat('en-NG', { style: 'currency', currency }).format(amount);

const formatDate = (d?: string) =>
  d ? new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '—';

export default function MentorPage() {
  const { user } = useAuth();

  const [loading, setLoading] = useState(true);
  const [mentor, setMentor] = useState<MentorProfile | null>(null);
  const [dashboard, setDashboard] = useState<{
    myMentees: MenteeRequest[];
    openRequests: MenteeRequest[];
    totalMentees: number;
    totalEarned: number;
  } | null>(null);

  const [company, setCompany] = useState('');
  const [roleType, setRoleType] = useState('');
  const [careerStory, setCareerStory] = useState('');
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');
  const [notice, setNotice] = useState('');

  const load = async () => {
    if (!user) return;
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/mentors/profile?userId=${encodeURIComponent(user.uid)}`);
      const data = await res.json();
      if (data.success && data.mentor) {
        setMentor(data.mentor);
        if (data.mentor.status === 'approved') {
          const dash = await fetch(`${API_BASE}/mentors/dashboard?userId=${encodeURIComponent(user.uid)}`);
          const dashData = await dash.json();
          if (dashData.success) setDashboard(dashData);
        }
      }
    } catch (err) {
      console.error('Failed to load mentor state:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [user?.uid]);

  const handleApply = async () => {
    if (!user) return;
    if (!company.trim() || !roleType || !careerStory.trim()) {
      setFormError('All fields are required.');
      return;
    }
    if (careerStory.trim().length < 20) {
      setFormError('Your career story must be at least 20 characters.');
      return;
    }
    setSaving(true);
    setFormError('');
    setNotice('');
    try {
      const res = await fetch(`${API_BASE}/mentors/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: user.uid,
          name: user.displayName || '',
          email: user.email || '',
          company: company.trim(),
          roleType,
          careerStory: careerStory.trim(),
        }),
      });
      const data = await res.json();
      if (data.success) {
        setNotice('Application submitted! An admin will review it before you are approved as a mentor.');
        await load();
      } else {
        setFormError(data.message || 'Registration failed. Please try again.');
      }
    } catch {
      setFormError('Could not connect to server. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  if (!user) return null;

  const isApproved = mentor?.status === 'approved';

  return (
    <div className="max-w-5xl mx-auto pb-12">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <div className="w-11 h-11 rounded-xl bg-primary/15 border border-primary/30 flex items-center justify-center">
          <Handshake className="h-5 w-5 text-primary" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-white">Mentors</h1>
          <p className="text-gray-400 text-sm">Your mentorship hub — manage mentees and track guidance earnings.</p>
        </div>
      </div>

      {notice && (
        <div className="flex items-center gap-2 rounded-xl border border-[#84cc16]/40 bg-[#84cc16]/10 px-4 py-2.5 text-[13px] font-medium text-[#84cc16] mb-5">
          <CheckCircle2 className="h-4 w-4" /> {notice}
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-20 text-gray-400">
          <Loader2 className="h-5 w-5 animate-spin mr-2" /> Loading…
        </div>
      ) : isApproved && dashboard ? (
        <ApprovedDashboard dashboard={dashboard} mentor={mentor!} />
      ) : (
        <ApplicationFlow
          mentor={mentor}
          company={company} setCompany={setCompany}
          roleType={roleType} setRoleType={setRoleType}
          careerStory={careerStory} setCareerStory={setCareerStory}
          saving={saving} formError={formError}
          onSubmit={handleApply}
          onReapply={() => { setFormError(''); setNotice(''); }}
        />
      )}
    </div>
  );
}

function ApplicationFlow(props: {
  mentor: MentorProfile | null;
  company: string; setCompany: (v: string) => void;
  roleType: string; setRoleType: (v: string) => void;
  careerStory: string; setCareerStory: (v: string) => void;
  saving: boolean; formError: string;
  onSubmit: () => void;
  onReapply: () => void;
}) {
  const { mentor, company, setCompany, roleType, setRoleType, careerStory, setCareerStory, saving, formError, onSubmit, onReapply } = props;

  if (mentor?.status === 'pending') {
    return (
      <div className="rounded-2xl glass-card p-6 sm:p-8 animate-in fade-in zoom-in-95 duration-200">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-12 h-12 rounded-full bg-amber-400/15 border border-amber-400/40 flex items-center justify-center">
            <Clock className="h-6 w-6 text-amber-400" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-white">Application under review</h2>
            <p className="text-gray-400 text-sm">You become a mentor only after an admin accepts your application.</p>
          </div>
        </div>
        <div className="rounded-xl bg-white/5 border border-white/10 p-4 text-sm space-y-1.5 mb-6">
          <p><span className="text-gray-500">Company:</span> <span className="text-gray-200 font-medium">{mentor.company}</span></p>
          <p><span className="text-gray-500">Industry:</span> <span className="text-gray-200 font-medium">{mentor.roleType}</span></p>
          <p className="text-gray-400 leading-relaxed">{mentor.careerStory}</p>
          <p className="text-gray-500 text-xs">Submitted {new Date(mentor.createdAt).toLocaleDateString()}</p>
        </div>
        <button
          onClick={onReapply}
          className="bg-white/5 border border-white/10 text-gray-200 font-semibold py-2.5 px-5 rounded-lg hover:bg-white/10 transition-colors text-sm"
        >
          Update application
        </button>
      </div>
    );
  }

  if (mentor?.status === 'rejected') {
    return (
      <div className="mb-6 rounded-2xl border border-red-500/40 bg-red-500/10 p-5 text-sm">
        <p className="text-red-300 font-semibold mb-1">Your mentor application was not accepted.</p>
        <p className="text-gray-400">You can update your details and apply again below.</p>
      </div>
    );
  }

  return (
    <div className="rounded-2xl glass-card p-6 sm:p-8 max-w-2xl">
      <div className="flex items-center gap-3 mb-4">
        <div className="w-12 h-12 rounded-full bg-primary/20 border border-primary/30 flex items-center justify-center">
          <UserPlus className="h-6 w-6 text-primary" />
        </div>
        <div>
          <h2 className="text-xl font-bold text-white">Become a Mentor</h2>
          <p className="text-gray-400 text-sm">Guide students through applications in your industry. Approval is required before you're active.</p>
        </div>
      </div>

      <div className="space-y-4">
        <div>
          <label className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Company / Organization</label>
          <input
            value={company}
            onChange={e => setCompany(e.target.value)}
            placeholder="e.g. Dangote Group"
            className="mt-1.5 w-full bg-white/5 border border-white/10 rounded-lg px-4 py-2.5 text-sm text-white placeholder:text-gray-500 focus:outline-none focus:border-primary transition-colors"
          />
        </div>
        <div>
          <label className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Industry you can guide in</label>
          <select
            value={roleType}
            onChange={e => setRoleType(e.target.value)}
            className="mt-1.5 w-full bg-white/5 border border-white/10 rounded-lg px-4 py-2.5 text-sm text-white focus:outline-none focus:border-primary transition-colors [&>option]:bg-[#111827]"
          >
            <option value="">Select your industry…</option>
            {ROLE_OPTIONS.map(r => <option key={r} value={r}>{r}</option>)}
          </select>
        </div>
        <div>
          <label className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Career story / Why you'd be a great mentor</label>
          <textarea
            value={careerStory}
            onChange={e => setCareerStory(e.target.value)}
            rows={4}
            placeholder="Tell students about your experience and how you can help them apply successfully…"
            className="mt-1.5 w-full bg-white/5 border border-white/10 rounded-lg px-4 py-2.5 text-sm text-white placeholder:text-gray-500 focus:outline-none focus:border-primary transition-colors resize-none"
          />
        </div>

        {formError && <p className="text-red-400 text-xs">{formError}</p>}

        <button
          onClick={onSubmit}
          disabled={saving}
          className="w-full flex items-center justify-center gap-2 bg-[#84cc16] text-[#0a0f16] font-bold py-3 rounded-lg hover:bg-[#a3e635] transition-colors text-sm disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {saving ? <><Loader2 className="h-4 w-4 animate-spin" /> Submitting…</> : <>Submit Application</>}
        </button>
      </div>
    </div>
  );
}

function ApprovedDashboard({ dashboard, mentor }: { dashboard: any; mentor: MentorProfile }) {
  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      <div className="grid sm:grid-cols-3 gap-4">
        <StatCard icon={<Users className="h-5 w-5" />} label="My Mentees" value={String(dashboard.totalMentees)} />
        <StatCard icon={<Wallet className="h-5 w-5" />} label="Total Earned (90%)" value={formatMoney(dashboard.totalEarned)} />
        <StatCard icon={<MessageCircle className="h-5 w-5" />} label="Requests Needing a Mentor" value={String(dashboard.openRequests?.length || 0)} />
      </div>

      <div className="rounded-2xl glass-card p-5 sm:p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-bold text-white uppercase tracking-wide flex items-center gap-2">
            <Users className="h-4 w-4 text-primary" /> My Mentees
          </h2>
          <span className="text-xs text-gray-500">{mentor.company} · {mentor.roleType}</span>
        </div>
        {dashboard.myMentees?.length ? (
          <MenteeTable rows={dashboard.myMentees} showAssigned={false} />
        ) : (
          <p className="text-gray-400 text-sm">No mentees assigned yet. You'll be matched with students based on your industry.</p>
        )}
      </div>

      <div className="rounded-2xl glass-card p-5 sm:p-6">
        <h2 className="text-sm font-bold text-white uppercase tracking-wide mb-4 flex items-center gap-2">
          <MessageCircle className="h-4 w-4 text-primary" /> Users Who Need Mentorship
        </h2>
        {dashboard.openRequests?.length ? (
          <MenteeTable rows={dashboard.openRequests} showAssigned={true} />
        ) : (
          <p className="text-gray-400 text-sm">No open requests right now.</p>
        )}
      </div>
    </div>
  );
}

function StatCard({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="rounded-2xl glass-card p-5">
      <div className="flex items-center gap-2 text-primary mb-2">
        <span className="p-2 rounded-lg bg-primary/10 border border-primary/20">{icon}</span>
      </div>
      <p className="text-2xl font-bold text-white">{value}</p>
      <p className="text-gray-400 text-xs mt-1">{label}</p>
    </div>
  );
}

function MenteeTable({ rows, showAssigned }: { rows: MenteeRequest[]; showAssigned: boolean }) {
  return (
    <div className="overflow-x-auto -mx-5 px-5">
      <table className="w-full text-left text-sm">
        <thead>
          <tr className="text-gray-500 text-xs uppercase tracking-wide border-b border-white/10">
            <th className="py-2.5 pr-4 font-semibold">Student</th>
            <th className="py-2.5 pr-4 font-semibold">Opportunity</th>
            <th className="py-2.5 pr-4 font-semibold">Type</th>
            {showAssigned && <th className="py-2.5 pr-4 font-semibold">Mentor</th>}
            <th className="py-2.5 pr-4 font-semibold">Paid</th>
            <th className="py-2.5 font-semibold">Date</th>
          </tr>
        </thead>
        <tbody>
          {rows.map(r => (
            <tr key={r._id} className="border-b border-white/5">
              <td className="py-3 pr-4">
                <p className="text-gray-200 font-medium">{r.userName || '—'}</p>
                {r.userEmail && <p className="text-gray-500 text-xs">{r.userEmail}</p>}
              </td>
              <td className="py-3 pr-4">
                <p className="text-gray-200 max-w-[260px] truncate">{r.opportunityTitle || '—'}</p>
                {r.opportunityOrg && <p className="text-gray-500 text-xs">{r.opportunityOrg}</p>}
              </td>
              <td className="py-3 pr-4 text-gray-400">{r.opportunityType || '—'}</td>
              {showAssigned && <td className="py-3 pr-4 text-gray-400">{r.mentorName || 'Unassigned'}</td>}
              <td className="py-3 pr-4 text-[#84cc16] font-semibold">{formatMoney(r.amount, r.currency)}</td>
              <td className="py-3 text-gray-500 text-xs">{formatDate(r.createdAt)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
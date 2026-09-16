import { useEffect, useState } from 'react';
import {
  CheckCircle2,
  Clock,
  Handshake,
  Loader2,
  UserPlus,
  Users,
  Wallet,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { API_BASE } from '../lib/applications';
import { apiFetch } from '../lib/api';

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
      const res = await apiFetch(`${API_BASE}/mentors/profile`);
      const data = await res.json();
      if (data.success && data.mentor) {
        setMentor(data.mentor);
        if (data.mentor.status === 'approved') {
          const dash = await apiFetch(`${API_BASE}/mentors/dashboard`);
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
      const res = await apiFetch(`${API_BASE}/mentors/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
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
    <div className="section-shell pb-12">
      {/* Header */}
      <div className="mb-8">
        <span className="eyebrow mb-3"><Handshake className="h-3.5 w-3.5" /> Mentorship</span>
        <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-white">Mentors</h1>
        <p className="text-gray-400 text-sm sm:text-base mt-1">Your mentorship hub — manage mentees and track guidance earnings.</p>
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
      <div className="card-surface p-6 sm:p-8 animate-in fade-in zoom-in-95 duration-200">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-12 h-12 rounded-full bg-amber-400/10 border border-amber-400/30 flex items-center justify-center shrink-0">
            <Clock className="h-6 w-6 text-amber-400" />
          </div>
          <div>
            <h2 className="text-lg sm:text-xl font-extrabold tracking-tight text-white">Application under review</h2>
            <p className="text-gray-400 text-sm mt-0.5">You become a mentor only after an admin accepts your application.</p>
          </div>
        </div>
        <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4 text-sm space-y-1.5 mb-6">
          <p><span className="text-gray-500">Company:</span> <span className="text-gray-200 font-medium">{mentor.company}</span></p>
          <p><span className="text-gray-500">Industry:</span> <span className="text-gray-200 font-medium">{mentor.roleType}</span></p>
          <p className="text-gray-400 leading-relaxed">{mentor.careerStory}</p>
          <p className="text-gray-500 text-xs">Submitted {new Date(mentor.createdAt).toLocaleDateString()}</p>
        </div>
        <button
          onClick={onReapply}
          className="btn-secondary h-10 text-sm"
        >
          Update application
        </button>
      </div>
    );
  }

  if (mentor?.status === 'rejected') {
    return (
      <div className="mb-6 rounded-xl border border-rose-400/30 bg-rose-400/5 p-5 text-sm">
        <p className="text-rose-300 font-semibold mb-1">Your mentor application was not accepted.</p>
        <p className="text-gray-400">You can update your details and apply again below.</p>
      </div>
    );
  }

  return (
    <div className="card-surface p-6 sm:p-8 max-w-2xl">
      <div className="flex items-center gap-3 mb-6">
        <div className="w-12 h-12 rounded-full bg-[#84cc16]/10 border border-[#84cc16]/30 flex items-center justify-center shrink-0">
          <UserPlus className="h-6 w-6 text-[#84cc16]" />
        </div>
        <div>
          <h2 className="text-lg sm:text-xl font-extrabold tracking-tight text-white">Become a Mentor</h2>
          <p className="text-gray-400 text-sm mt-0.5">Guide students through applications in your industry. Approval is required before you're active.</p>
        </div>
      </div>

      <div className="space-y-4">
        <div>
          <label className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Company / Organization</label>
          <input
            value={company}
            onChange={e => setCompany(e.target.value)}
            placeholder="e.g. Dangote Group"
            className="input-base mt-1.5"
          />
        </div>
        <div>
          <label className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Industry you can guide in</label>
          <select
            value={roleType}
            onChange={e => setRoleType(e.target.value)}
            className="input-base mt-1.5 appearance-none [&>option]:bg-[#0d1308]"
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
            className="input-base mt-1.5 resize-none"
          />
        </div>

        {formError && <p className="text-rose-400 text-xs mt-1">{formError}</p>}

        <button
          onClick={onSubmit}
          disabled={saving}
          className="btn-primary w-full h-11 text-sm"
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
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        <StatCard icon={<Users className="h-5 w-5" />} label="My Mentees" value={String(dashboard.totalMentees)} />
        <StatCard icon={<Wallet className="h-5 w-5" />} label="Total Earned (90%)" value={formatMoney(dashboard.totalEarned)} />
        </div>

      <div className="card-surface p-5 sm:p-6 overflow-hidden">
        <div className="flex items-center justify-between gap-3 flex-wrap mb-4">
          <h2 className="flex items-center gap-2 text-sm font-bold text-white uppercase tracking-wide">
            <Users className="h-4 w-4 text-[#84cc16]" /> My Mentees
          </h2>
          <span className="text-xs text-gray-500">{mentor.company} · {mentor.roleType}</span>
        </div>
        {dashboard.myMentees?.length ? (
          <MenteeTable rows={dashboard.myMentees} />
        ) : (
          <p className="text-gray-400 text-sm">No mentees assigned yet. You'll be matched with students based on your industry.</p>
        )}
      </div>
    </div>
  );
}

function StatCard({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="card-surface p-5 min-w-0">
      <span className="p-2 rounded-lg bg-[#84cc16]/10 border border-[#84cc16]/20 text-[#84cc16] inline-flex mb-2">{icon}</span>
      <p className="text-2xl font-extrabold text-white tabular-nums">{value}</p>
      <p className="text-gray-400 text-xs mt-1">{label}</p>
    </div>
  );
}

function MenteeTable({ rows }: { rows: MenteeRequest[] }) {
  return (
    <div className="overflow-x-auto -mx-5 px-5 sm:-mx-6 sm:px-6">
      <table className="w-full text-left text-sm">
        <thead>
          <tr className="text-gray-500 text-xs uppercase tracking-wide border-b border-white/10">
            <th className="py-2.5 pr-4 font-semibold whitespace-nowrap">Student</th>
            <th className="py-2.5 pr-4 font-semibold whitespace-nowrap">Opportunity</th>
            <th className="py-2.5 pr-4 font-semibold whitespace-nowrap">Type</th>
            <th className="py-2.5 pr-4 font-semibold whitespace-nowrap">Paid</th>
            <th className="py-2.5 font-semibold whitespace-nowrap">Date</th>
          </tr>
        </thead>
        <tbody>
          {rows.map(r => (
            <tr key={r._id} className="border-b border-white/5">
              <td className="py-3 pr-4 whitespace-nowrap">
                <p className="text-gray-200 font-medium">{r.userName || '—'}</p>
                {r.userEmail && <p className="text-gray-500 text-xs">{r.userEmail}</p>}
              </td>
              <td className="py-3 pr-4">
                <p className="text-gray-200 max-w-[240px] truncate">{r.opportunityTitle || '—'}</p>
                {r.opportunityOrg && <p className="text-gray-500 text-xs">{r.opportunityOrg}</p>}
              </td>
              <td className="py-3 pr-4 text-gray-400 whitespace-nowrap">{r.opportunityType || '—'}</td>
              <td className="py-3 pr-4 text-[#84cc16] font-semibold tabular-nums whitespace-nowrap">{formatMoney(r.amount, r.currency)}</td>
              <td className="py-3 text-gray-500 text-xs whitespace-nowrap">{formatDate(r.createdAt)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
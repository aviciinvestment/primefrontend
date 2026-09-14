import { useState, useEffect, useRef } from 'react';
import {
  X,
  XCircle,
  Loader2,
  GraduationCap,
  User as UserIcon,
  Briefcase,
  BookOpen,
  Download,
  Trash2,
  RefreshCw,
  Camera,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';

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

const API_URL = 'http://localhost:5000';

const formatDate = (dateStr: string) =>
  new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

interface SavedCv {
  _id: string;
  fileName: string;
  createdAt: string;
  analysis: string;
  matches: any[];
  highlights?: { roles: string[]; skills: string[]; education: string[] };
}

export default function Profile() {
  const { user, updatePhoto } = useAuth();

  const [cvs, setCvs] = useState<SavedCv[]>([]);
  const [cvsLoading, setCvsLoading] = useState(true);
  const [cvsBusy, setCvsBusy] = useState<'download' | 'delete' | 'change' | null>(null);

  const [isMentor, setIsMentor] = useState(false);
  const [mentorProfile, setMentorProfile] = useState<any>(null);
  const [mentorLoading, setMentorLoading] = useState(true);

  const [showModal, setShowModal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');

  const [company, setCompany] = useState('');
  const [roleType, setRoleType] = useState('');
  const [careerStory, setCareerStory] = useState('');

  const [notice, setNotice] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null);
  const noticeTimerRef = useRef<number | null>(null);

  const photoInputRef = useRef<HTMLInputElement>(null);
  const cvInputRef = useRef<HTMLInputElement>(null);

  const memberSince = user?.metadata?.creationTime
    ? new Date(user.metadata.creationTime).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
    : '';

  const showNotice = (kind: 'ok' | 'err', text: string) => {
    setNotice({ kind, text });
    if (noticeTimerRef.current !== null) window.clearTimeout(noticeTimerRef.current);
    noticeTimerRef.current = window.setTimeout(() => setNotice(null), 4500);
  };

  const loadCvs = async () => {
    if (!user) return;
    try {
      const res = await fetch(`${API_URL}/api/ai/my-cvs?userId=${encodeURIComponent(user.uid)}`);
      const data = await res.json();
      if (data.success) setCvs(data.cvs || []);
    } catch {
      showNotice('err', 'Could not load your CVs.');
    } finally {
      setCvsLoading(false);
    }
  };

  useEffect(() => {
    if (!user) return;
    loadCvs();
    const loadMentor = async () => {
      try {
        const res = await fetch(`${API_URL}/api/mentors/profile?userId=${encodeURIComponent(user.uid)}`);
        const data = await res.json();
        setIsMentor(data.isMentor);
        setMentorProfile(data.mentor);
      } catch {
        /* silent */
      } finally {
        setMentorLoading(false);
      }
    };
    loadMentor();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  // ---- Profile picture ----
  const handlePhotoChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    if (!/^image\//.test(file.type)) {
      showNotice('err', 'Please choose an image file.');
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      showNotice('err', 'Image must be under 2MB.');
      return;
    }
    const reader = new FileReader();
    reader.onload = async () => {
      try {
        await updatePhoto(String(reader.result));
        showNotice('ok', 'Profile picture updated.');
      } catch {
        showNotice('err', 'Could not update profile picture. Try a smaller image.');
      }
    };
    reader.readAsDataURL(file);
  };

  // ---- CV replace ----
  const handleCvChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file || !user) return;
    setCvsBusy('change');
    const formData = new FormData();
    formData.append('cv', file);
    formData.append('userId', user.uid);
    formData.append('userEmail', user.email || '');
    formData.append('userName', user.displayName || '');
    try {
      const res = await fetch(`${API_URL}/api/ai/analyze-cv`, { method: 'POST', body: formData });
      const data = await res.json();
      if (data.success) {
        showNotice('ok', 'CV updated — new analysis complete.');
        await loadCvs();
      } else {
        showNotice('err', data.message || 'CV upload failed.');
      }
    } catch {
      showNotice('err', 'Could not connect to server while updating CV.');
    } finally {
      setCvsBusy(null);
    }
  };

  // ---- CV delete ----
  const handleCvDelete = async (cvId: string) => {
    if (!user) return;
    if (!window.confirm('Delete this CV? This cannot be undone.')) return;
    setCvsBusy('delete');
    try {
      const res = await fetch(`${API_URL}/api/ai/cv/${cvId}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: user.uid }),
      });
      const data = await res.json();
      if (data.success) {
        showNotice('ok', 'CV deleted.');
        await loadCvs();
      } else {
        showNotice('err', data.message || 'Could not delete the CV.');
      }
    } catch {
      showNotice('err', 'Could not connect to server while deleting CV.');
    } finally {
      setCvsBusy(null);
    }
  };

  // ---- Mentor ----
  const openMentorModal = () => {
    setCompany('');
    setRoleType('');
    setCareerStory('');
    setFormError('');
    setShowModal(true);
  };

  const handleMentorRegister = async () => {
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
    try {
      const res = await fetch(`${API_URL}/api/mentors/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: user?.uid,
          name: user?.displayName || '',
          email: user?.email || '',
          company: company.trim(),
          roleType,
          careerStory: careerStory.trim(),
        }),
      });
      const data = await res.json();
      if (data.success) {
        setIsMentor(true);
        setMentorProfile(data.mentor);
        setShowModal(false);
        showNotice('ok', 'You are now a mentor!');
      } else {
        setFormError(data.message || 'Registration failed. Please try again.');
      }
    } catch {
      setFormError('Could not connect to server. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const latestCv = cvs.length > 0 ? cvs[0] : null;
  const chip = (cls: string) =>
    `inline-flex items-center rounded-full border border-white/10 bg-white/5 px-2.5 py-0.5 text-[11px] font-medium text-gray-300`;

  if (!user) return null;

  return (
    <div className="mx-auto max-w-5xl space-y-6 pb-12">

      {/* Transient notice */}
      {notice && (
        <div
          className={`flex items-center gap-2 rounded-xl border px-4 py-2.5 text-[13px] font-medium ${
            notice.kind === 'ok'
              ? 'border-[#84cc16]/40 bg-[#84cc16]/10 text-[#84cc16]'
              : 'border-red-500/40 bg-red-500/10 text-red-400'
          }`}
        >
          {notice.kind === 'ok' ? <GraduationCap className="h-4 w-4" /> : <XCircle className="h-4 w-4" />}
          {notice.text}
        </div>
      )}

      {/* ---- Header ---- */}
      <div className="flex flex-col justify-between gap-6 rounded-2xl border border-white/10 bg-white/[0.03] p-6 sm:flex-row sm:items-center sm:gap-8">
        <div className="flex flex-col items-start gap-4 sm:flex-row sm:items-center sm:gap-6">
          <div className="relative shrink-0">
            {user.photoURL ? (
              <img
                src={user.photoURL}
                alt="avatar"
                className="h-24 w-24 rounded-full border-4 border-white/10 object-cover shadow-[0_0_25px_rgba(132,204,22,0.25)]"
              />
            ) : (
              <div className="flex h-24 w-24 items-center justify-center rounded-full border-4 border-white/10 bg-[#84cc16]/20 text-3xl font-bold text-[#84cc16] shadow-[0_0_25px_rgba(132,204,22,0.25)]">
                {(user.displayName || user.email || '?')[0]?.toUpperCase()}
              </div>
            )}
            <button
              onClick={() => photoInputRef.current?.click()}
              aria-label="Change profile picture"
              title="Change photo"
              className="absolute -bottom-1 -right-1 flex h-8 w-8 items-center justify-center rounded-full bg-[#84cc16] text-[#070e0a] border-2 border-[#0a100d] shadow-md transition-all hover:scale-110 active:scale-95"
            >
              <Camera className="h-4 w-4" />
            </button>
            <input ref={photoInputRef} type="file" accept="image/*" className="hidden" onChange={handlePhotoChange} />
          </div>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-3">
              <h1 className="truncate text-2xl font-bold tracking-tight sm:text-3xl">
                {user.displayName || 'Your Account'}
              </h1>
              {isMentor && (
                <span className="inline-flex items-center gap-1 rounded-full border border-[#84cc16]/40 bg-[#84cc16]/15 px-3 py-0.5 text-[11px] font-bold uppercase tracking-wide text-[#84cc16]">
                  Mentor
                </span>
              )}
            </div>
            <p className="mt-1 text-sm text-gray-400">{user.email}</p>
            {memberSince && <p className="mt-1 text-[12px] text-gray-500">Member since {memberSince}</p>}
          </div>
        </div>
      </div>

      {/* ---- Three-column symmetric grid (desktop) ---- */}
      <div className="grid grid-cols-1 gap-6 md:grid-cols-3">

        {/* ---- CV card ---- */}
        <section className="flex h-full flex-col rounded-2xl border border-white/10 bg-white/[0.03] p-6">
          <h2 className="mb-4 flex items-center gap-2 text-[16px] font-bold">
            <Briefcase className="h-5 w-5 text-[#84cc16]" /> CV Highlights
          </h2>

          {cvsLoading ? (
            <div className="flex items-center gap-2 text-sm text-gray-400">
              <Loader2 className="h-4 w-4 animate-spin" /> Loading…
            </div>
          ) : latestCv ? (
            <div className="flex flex-1 flex-col gap-4">
              <div>
                <div className="flex items-center justify-between gap-2">
                  <span className="truncate text-[13px] font-medium text-gray-200">📄 {latestCv.fileName}</span>
                  <span className="shrink-0 text-[11px] text-gray-500">{formatDate(latestCv.createdAt)}</span>
                </div>

                <div className="mt-4 space-y-3">
                  {latestCv.highlights?.roles?.length > 0 && (
                    <div>
                      <p className="mb-1.5 text-[11px] font-medium uppercase tracking-wider text-gray-500">Roles</p>
                      <div className="flex flex-wrap gap-1.5">
                        {latestCv.highlights.roles.map(r => (
                          <span key={r} className={chip('')}>{r}</span>
                        ))}
                      </div>
                    </div>
                  )}
                  {latestCv.highlights?.skills?.length > 0 && (
                    <div>
                      <p className="mb-1.5 text-[11px] font-medium uppercase tracking-wider text-gray-500">Skills</p>
                      <div className="flex flex-wrap gap-1.5">
                        {latestCv.highlights.skills.map(s => (
                          <span key={s} className={chip('')}>{s}</span>
                        ))}
                      </div>
                    </div>
                  )}
                  {latestCv.highlights?.education?.length > 0 && (
                    <div>
                      <p className="mb-1.5 text-[11px] font-medium uppercase tracking-wider text-gray-500">Education</p>
                      <div className="flex flex-wrap gap-1.5">
                        {latestCv.highlights.education.map(e => (
                          <span key={e} className={chip('')}>{e}</span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>

              <div className="mt-auto space-y-2 border-t border-white/10 pt-4">
                <a
                  href={`${API_URL}/api/ai/cv/${latestCv._id}/download?userId=${encodeURIComponent(user.uid)}`}
                  className="flex h-9 w-full items-center justify-center gap-2 rounded-lg bg-[#84cc16] text-[13px] font-bold text-[#070e0a] transition-all hover:scale-[1.02] active:scale-95"
                >
                  <Download className="h-4 w-4" /> Download CV
                </a>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={() => cvInputRef.current?.click()}
                    disabled={cvsBusy !== null}
                    className="flex h-9 items-center justify-center gap-2 rounded-lg border border-white/15 bg-white/5 text-[12px] font-medium text-gray-200 transition-all hover:bg-white/10 disabled:opacity-50"
                  >
                    {cvsBusy === 'change' ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
                    Change
                  </button>
                  <button
                    onClick={() => handleCvDelete(latestCv._id)}
                    disabled={cvsBusy !== null}
                    className="flex h-9 items-center justify-center gap-2 rounded-lg border border-red-500/30 bg-red-500/10 text-[12px] font-medium text-red-400 transition-all hover:bg-red-500/20 disabled:opacity-50"
                  >
                    {cvsBusy === 'delete' ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
                    Delete
                  </button>
                </div>
                <input ref={cvInputRef} type="file" accept=".pdf" className="hidden" onChange={handleCvChange} />
              </div>
            </div>
          ) : (
            <div className="flex flex-1 flex-col">
              <p className="text-[13px] leading-relaxed text-gray-500">
                Upload a CV from the Dashboard to unlock AI-matched opportunities and see your key roles, skills and education here.
              </p>
            </div>
          )}
        </section>

        {/* ---- Mentorship card ---- */}
        <section className="flex h-full flex-col rounded-2xl border border-white/10 bg-white/[0.03] p-6">
          <h2 className="mb-4 flex items-center gap-2 text-[16px] font-bold">
            <GraduationCap className="h-5 w-5 text-[#84cc16]" /> Mentorship
          </h2>
          <div className="flex flex-1 flex-col">
            {mentorLoading ? (
              <div className="flex items-center gap-2 text-sm text-gray-400">
                <Loader2 className="h-4 w-4 animate-spin" /> Loading…
              </div>
            ) : isMentor && mentorProfile ? (
              <div className="flex flex-1 flex-col gap-4">
                <p className="text-[13px] leading-relaxed text-gray-400">
                  You are registered as a mentor on PrimeOpportunity. Students can reach out to you for guidance.
                </p>
                <div className="space-y-2">
                  <div>
                    <p className="mb-0.5 text-[11px] font-medium uppercase tracking-wider text-gray-500">Company</p>
                    <p className="text-[14px] font-semibold text-gray-200">{mentorProfile.company}</p>
                  </div>
                  <div>
                    <p className="mb-0.5 text-[11px] font-medium uppercase tracking-wider text-gray-500">Role / Industry</p>
                    <p className="text-[14px] font-semibold text-gray-200">{mentorProfile.roleType}</p>
                  </div>
                </div>
                <div className="flex-1">
                  <p className="mb-1 text-[11px] font-medium uppercase tracking-wider text-gray-500">Your Story</p>
                  <p className="text-[13px] leading-relaxed text-gray-300">{mentorProfile.careerStory}</p>
                </div>
                <p className="text-[11px] text-gray-500">Registered {formatDate(mentorProfile.createdAt)}</p>
              </div>
            ) : (
              <div className="flex flex-1 flex-col">
                <p className="text-[13px] leading-relaxed text-gray-400">
                  Share your professional journey to guide students and early-career professionals.
                </p>
                <button
                  onClick={openMentorModal}
                  className="mt-auto inline-flex h-11 w-full items-center justify-center rounded-xl bg-[#84cc16] text-[13px] font-bold text-[#070e0a] shadow-[0_0_18px_rgba(132,204,22,0.3)] transition-all hover:scale-[1.02] active:scale-95"
                >
                  Be a Mentor
                </button>
              </div>
            )}
          </div>
        </section>

        {/* ---- Account card ---- */}
        <section className="flex h-full flex-col rounded-2xl border border-white/10 bg-white/[0.03] p-6">
          <h2 className="mb-4 flex items-center gap-2 text-[16px] font-bold">
            <UserIcon className="h-5 w-5 text-[#84cc16]" /> Account
          </h2>
          <dl className="space-y-3 text-[13px]">
            <div className="flex items-center justify-between gap-3">
              <dt className="text-gray-500">Display name</dt>
              <dd className="truncate font-medium text-gray-200">{user.displayName || '—'}</dd>
            </div>
            <div className="flex items-center justify-between gap-3">
              <dt className="text-gray-500">Email</dt>
              <dd className="truncate font-medium text-gray-200">{user.email}</dd>
            </div>
            <div className="flex items-center justify-between gap-3">
              <dt className="text-gray-500">Role</dt>
              <dd className="font-medium text-gray-200">{isMentor ? 'Mentor' : 'Member'}</dd>
            </div>
            <div className="flex items-center justify-between gap-3">
              <dt className="text-gray-500">Member since</dt>
              <dd className="font-medium text-gray-200">{memberSince || '—'}</dd>
            </div>
          </dl>
          <div className="mt-6 rounded-xl border border-white/10 bg-white/[0.03] p-4">
            <h3 className="mb-2 flex items-center gap-2 text-[13px] font-bold">
              <BookOpen className="h-4 w-4 text-[#84cc16]" /> AI Scout
            </h3>
            <div className="mb-1.5 flex items-center gap-2">
              <span className="h-2.5 w-2.5 rounded-full bg-[#84cc16] animate-pulse"></span>
              <span className="text-[12px] text-gray-400">Actively scanning for matches</span>
            </div>
            <p className="text-[12px] text-gray-500">
              The AI Scout reviews new opportunities daily and surfaces the best fits for you.
            </p>
          </div>
        </section>
      </div>

      {/* ---- Mentor Registration Modal ---- */}
      {showModal && (
        <div
          className="fixed inset-0 z-[110] flex items-center justify-center bg-black/70 px-4 backdrop-blur-sm"
          onClick={() => !saving && setShowModal(false)}
        >
          <div
            className="relative w-full max-w-lg space-y-5 rounded-2xl border border-white/10 bg-[#0a100d] p-6 shadow-2xl sm:p-8"
            onClick={e => e.stopPropagation()}
          >
            <button
              onClick={() => !saving && setShowModal(false)}
              className="absolute right-4 top-4 text-gray-500 transition-colors hover:text-white"
            >
              <X className="h-5 w-5" />
            </button>

            <div>
              <h2 className="text-xl font-bold">Become a Mentor</h2>
              <p className="mt-1 text-[13px] text-gray-400">
                Your profile will be updated to <span className="font-semibold text-[#84cc16]">Mentor</span> once registered.
              </p>
            </div>

            <div className="space-y-4">
              <div>
                <label className="mb-1 block text-[12px] font-medium text-gray-400">Company</label>
                <input
                  value={company}
                  onChange={e => setCompany(e.target.value)}
                  placeholder="e.g. Paystack, KPMG, MTN"
                  className="h-11 w-full rounded-xl border border-white/10 bg-white/5 px-4 text-[14px] text-white placeholder:text-gray-500 focus:border-[#84cc16]/60 focus:outline-none focus:ring-1 focus:ring-[#84cc16]/40"
                />
              </div>

              <div>
                <label className="mb-1 block text-[12px] font-medium text-gray-400">Role / Industry</label>
                <select
                  value={roleType}
                  onChange={e => setRoleType(e.target.value)}
                  className="h-11 w-full appearance-none rounded-xl border border-white/10 bg-white/5 px-4 text-[14px] text-white focus:border-[#84cc16]/60 focus:outline-none focus:ring-1 focus:ring-[#84cc16]/40"
                >
                  <option value="" disabled className="bg-[#0a100d] text-gray-400">
                    Select your industry…
                  </option>
                  {ROLE_OPTIONS.map(opt => (
                    <option key={opt} value={opt} className="bg-[#0a100d] text-white">
                      {opt}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="mb-1 block text-[12px] font-medium text-gray-400">
                  How did you get into this industry?
                </label>
                <textarea
                  value={careerStory}
                  onChange={e => setCareerStory(e.target.value)}
                  rows={4}
                  placeholder="Share a brief version of your career journey…"
                  className="w-full resize-none rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-[14px] text-white placeholder:text-gray-500 focus:border-[#84cc16]/60 focus:outline-none focus:ring-1 focus:ring-[#84cc16]/40"
                />
                <p className="mt-1 text-right text-[11px] text-gray-500">
                  {careerStory.length.toLocaleString()} / 2,000
                </p>
              </div>
            </div>

            {formError && (
              <p className="rounded-lg bg-red-500/10 px-3 py-2 text-[13px] text-red-400">{formError}</p>
            )}

            <button
              onClick={handleMentorRegister}
              disabled={saving}
              className="flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-[#84cc16] text-[14px] font-bold text-[#070e0a] transition-all hover:scale-[1.02] active:scale-95 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {saving && <Loader2 className="h-4 w-4 animate-spin" />}
              {saving ? 'Registering…' : 'Register as Mentor'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
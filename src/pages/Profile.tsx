import { useState, useEffect, useRef } from 'react';
import {
  X,
  XCircle,
  GraduationCap,
  User as UserIcon,
  Briefcase,
  BookOpen,
  Download,
  Trash2,
  RefreshCw,
  Camera,
  Clock,
  CheckCircle2,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { BreathingLoader } from '../components/BreathingLoader';
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

const API_URL = API_BASE;

const formatDate = (dateStr: string) =>
  new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

interface SavedCv {
  _id: string;
  fileName: string;
  createdAt: string;
  matches: any[];
  highlights?: { roles: string[]; skills: string[]; education: string[] };
}

export default function Profile() {
  const { user, updatePhoto } = useAuth();

  const [cvs, setCvs] = useState<SavedCv[]>([]);
  const [cvsLoading, setCvsLoading] = useState(true);
  const [cvsBusy, setCvsBusy] = useState<'download' | 'delete' | 'change' | null>(null);

  const [isMentor, setIsMentor] = useState(false);
  const [mentorStatus, setMentorStatus] = useState<'pending' | 'approved' | 'rejected' | null>(null);
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
      const res = await apiFetch(`${API_URL}/ai/my-cvs`);
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
        const res = await apiFetch(`${API_URL}/mentors/profile`);
        const data = await res.json();
        setIsMentor(data.isMentor);
        setMentorStatus(data.mentor?.status ?? null);
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
    try {
      const res = await apiFetch(`${API_URL}/ai/analyze-cv`, { method: 'POST', body: formData });
      const data = await res.json();
      if (data.success) {
        showNotice('ok', 'CV updated — matches refreshed.');
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
      const res = await apiFetch(`${API_URL}/ai/cv/${cvId}`, { method: 'DELETE' });
      const data = await res.json();
      if (data.success) {
        showNotice('ok', 'CV deleted.');
        // Drop it locally first so the UI never keeps a ghost entry even if
        // the follow-up list refresh silently fails (e.g. rate limited).
        setCvs(prev => prev.filter(c => c._id !== cvId));
        await loadCvs();
      } else {
        showNotice('err', (data.message || 'Could not delete the CV.') + (data.error ? ` — ${data.error}` : ''));
      }
    } catch {
      showNotice('err', 'Could not connect to server while deleting CV.');
    } finally {
      setCvsBusy(null);
    }
  };

  // ---- CV download ----
  const handleCvDownload = async (cvId: string) => {
    if (!user) return;
    setCvsBusy('download');
    try {
      const res = await apiFetch(`${API_URL}/ai/cv/${cvId}/download`);
      if (!res.ok) throw new Error('Download failed');
      const blob = await res.blob();
      const disposition = res.headers.get('Content-Disposition') || '';
      const match = /filename="([^"]+)"/.exec(disposition);
      const fileName = match?.[1] || 'cv.pdf';
      const objectUrl = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = objectUrl;
      link.download = fileName;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(objectUrl);
    } catch {
      showNotice('err', 'Could not download your CV.');
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
      const res = await apiFetch(`${API_URL}/mentors/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: user?.displayName || '',
          email: user?.email || '',
          company: company.trim(),
          roleType,
          careerStory: careerStory.trim(),
        }),
      });
      const data = await res.json();
      if (data.success) {
        setIsMentor(data.isMentor);
        setMentorStatus(data.mentor?.status ?? null);
        setMentorProfile(data.mentor);
        setShowModal(false);
        if (data.mentor?.status === 'approved') {
          showNotice('ok', 'You are now a mentor!');
        } else {
          showNotice('ok', 'Mentor application submitted! An admin will review it shortly.');
        }
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
  const chip = (_cls: string) =>
    `inline-flex items-center rounded-full border border-white/10 bg-white/[0.04] px-2.5 py-0.5 text-[11px] font-medium text-gray-300`;

  if (!user) return null;

  return (
    <div className="section-shell max-w-5xl space-y-6 pb-12">

      {/* Transient notice */}
      {notice && (
        <div
          className={`flex items-center gap-2 rounded-xl border px-4 py-2.5 text-[13px] font-medium ${
            notice.kind === 'ok'
              ? 'border-brand-solid/40 bg-brand/10 text-brand'
              : 'border-red-500/40 bg-red-500/10 text-red-400'
          }`}
        >
          {notice.kind === 'ok' ? <GraduationCap className="h-4 w-4" /> : <XCircle className="h-4 w-4" />}
          {notice.text}
        </div>
      )}

      {/* ---- Header ---- */}
      <div className="card-surface flex flex-col justify-between gap-6 p-6 sm:p-8 sm:flex-row sm:items-center sm:gap-8">
        <div className="flex flex-col items-start gap-4 sm:flex-row sm:items-center sm:gap-6">
          <div className="relative shrink-0">
            {user.photoURL ? (
              <img
                src={user.photoURL}
                alt="avatar"
                className="h-24 w-24 rounded-full border-4 border-white/10 object-cover shadow-[0_0_25px_rgba(132,204,22,0.25)]"
              />
            ) : (
              <div className="flex h-24 w-24 items-center justify-center rounded-full border-4 border-white/10 bg-brand/20 text-3xl font-bold text-brand shadow-[0_0_25px_rgba(132,204,22,0.25)]">
                {(user.displayName || user.email || '?')[0]?.toUpperCase()}
              </div>
            )}
            <button
              onClick={() => photoInputRef.current?.click()}
              aria-label="Change profile picture"
              title="Change photo"
              className="absolute -bottom-1 -right-1 flex h-8 w-8 items-center justify-center rounded-full bg-brand-solid text-[#070e0a] border-2 border-[#0a100d] shadow-md transition-all hover:scale-110 active:scale-95 focus-ring"
            >
              <Camera className="h-4 w-4" />
            </button>
            <input ref={photoInputRef} type="file" accept="image/*" className="hidden" onChange={handlePhotoChange} />
          </div>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-3">
              <h1 className="truncate text-2xl sm:text-3xl font-extrabold tracking-tight text-white">
                {user.displayName || 'Your Account'}
              </h1>
              {isMentor && (
                <span className="eyebrow">
                  Mentor
                </span>
              )}
            </div>
            <p className="mt-1 text-sm text-gray-400">
              {user.email}
              {user.emailVerified ? (
                <span className="ml-2 inline-flex items-center gap-1 rounded-full border border-brand-solid/30 bg-brand/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-brand">
                  <CheckCircle2 className="h-3 w-3" /> Verified
                </span>
              ) : (
                <span className="ml-2 inline-flex items-center gap-1 rounded-full border border-amber-400/30 bg-amber-400/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-amber-300">
                  Unverified
                </span>
              )}
            </p>
            {memberSince && <p className="mt-1 text-[12px] text-gray-500">Member since {memberSince}</p>}
          </div>
        </div>
      </div>

      {/* ---- Three-column symmetric grid (desktop) ---- */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">

        {/* ---- CV card ---- */}
        <section className="card-surface flex h-full flex-col p-6 sm:p-8">
          <h2 className="mb-4 flex items-center gap-2 text-base font-bold text-white">
            <Briefcase className="h-5 w-5 text-brand" /> CV Highlights
          </h2>

          {cvsLoading ? (
            <div className="flex items-center gap-2 text-sm text-gray-400">
              <BreathingLoader size="md" dots={3} /> Loading…
            </div>
          ) : latestCv ? (
            <div className="flex flex-1 flex-col gap-4">
              <div>
                <div className="flex items-center justify-between gap-2">
                  <span className="truncate text-[13px] font-medium text-gray-200">📄 {latestCv.fileName}</span>
                  <span className="shrink-0 text-[11px] text-gray-500">{formatDate(latestCv.createdAt)}</span>
                </div>

                <div className="mt-4 space-y-3">
                  {!!latestCv.highlights?.roles?.length && (
                    <div>
                      <p className="mb-1.5 text-[11px] font-medium uppercase tracking-wider text-gray-500">Roles</p>
                      <div className="flex flex-wrap gap-1.5">
                        {latestCv.highlights?.roles.map(r => (
                          <span key={r} className={chip('')}>{r}</span>
                        ))}
                      </div>
                    </div>
                  )}
                  {!!latestCv.highlights?.skills?.length && (
                    <div>
                      <p className="mb-1.5 text-[11px] font-medium uppercase tracking-wider text-gray-500">Skills</p>
                      <div className="flex flex-wrap gap-1.5">
                        {latestCv.highlights?.skills.map(s => (
                          <span key={s} className={chip('')}>{s}</span>
                        ))}
                      </div>
                    </div>
                  )}
                  {!!latestCv.highlights?.education?.length && (
                    <div>
                      <p className="mb-1.5 text-[11px] font-medium uppercase tracking-wider text-gray-500">Education</p>
                      <div className="flex flex-wrap gap-1.5">
                        {latestCv.highlights?.education.map(e => (
                          <span key={e} className={chip('')}>{e}</span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>

              <div className="mt-auto space-y-2 border-t border-white/10 pt-4">
                <button
                  onClick={() => handleCvDownload(latestCv._id)}
                  disabled={cvsBusy !== null}
                  className={`btn-primary btn-busy h-11 w-full text-sm`}
                >
                  {cvsBusy === 'download' ? <BreathingLoader size="md" dots={3} tone="dark" /> : <Download className="h-4 w-4" />}
                  Download CV
                </button>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={() => cvInputRef.current?.click()}
                    disabled={cvsBusy !== null}
                    className={`btn-secondary btn-busy h-11 text-xs`}
                  >
                    {cvsBusy === 'change' ? <BreathingLoader size="sm" dots={3} /> : <RefreshCw className="h-3.5 w-3.5" />}
                    Change
                  </button>
                  <button
                    onClick={() => handleCvDelete(latestCv._id)}
                    disabled={cvsBusy !== null}
                    className={`btn-danger btn-busy h-11 text-xs`}
                  >
                    {cvsBusy === 'delete' ? <BreathingLoader size="sm" dots={3} /> : <Trash2 className="h-3.5 w-3.5" />}
                    Delete
                  </button>
                </div>
                <input ref={cvInputRef} type="file" accept=".pdf" className="hidden" onChange={handleCvChange} />
              </div>
            </div>
          ) : (
            <div className="flex flex-1 flex-col">
              <p className="text-sm leading-relaxed text-gray-400">
                Upload a CV from the Dashboard to unlock AI-matched opportunities and see your key roles, skills and education here.
              </p>
            </div>
          )}
        </section>

        {/* ---- Mentorship card ---- */}
        <section className="card-surface flex h-full flex-col p-6 sm:p-8">
          <h2 className="mb-4 flex items-center gap-2 text-base font-bold text-white">
            <GraduationCap className="h-5 w-5 text-brand" /> Mentorship
          </h2>
          <div className="flex flex-1 flex-col">
            {mentorLoading ? (
              <div className="flex items-center gap-2 text-sm text-gray-400">
                <BreathingLoader size="md" dots={3} /> Loading…
              </div>
            ) : isMentor && mentorProfile ? (
              <div className="flex flex-1 flex-col gap-4">
                <p className="text-sm leading-relaxed text-gray-400">
                  You are registered as a mentor on PrimeOpportunity. Students can reach out to you for guidance.
                </p>
                <div className="space-y-2">
                  <div>
                    <p className="mb-0.5 text-[11px] font-medium uppercase tracking-wider text-gray-500">Company</p>
                    <p className="text-sm font-semibold text-gray-200">{mentorProfile.company}</p>
                  </div>
                  <div>
                    <p className="mb-0.5 text-[11px] font-medium uppercase tracking-wider text-gray-500">Role / Industry</p>
                    <p className="text-sm font-semibold text-gray-200">{mentorProfile.roleType}</p>
                  </div>
                </div>
                <div className="flex-1">
                  <p className="mb-1 text-[11px] font-medium uppercase tracking-wider text-gray-500">Your Story</p>
                  <p className="text-sm leading-relaxed text-gray-300">{mentorProfile.careerStory}</p>
                </div>
                <p className="text-[11px] text-gray-500">Registered {formatDate(mentorProfile.createdAt)}</p>
              </div>
            ) : mentorProfile && !isMentor ? (
              <div className="flex flex-1 flex-col">
                {mentorStatus === 'rejected' ? (
                  <>
                    <p className="mb-2 rounded-lg border border-rose-500/40 bg-rose-500/10 px-3 py-2 text-xs text-rose-300">
                      Your mentor application was not accepted. You can re-apply.
                    </p>
                    <button
                      onClick={openMentorModal}
                      className="mt-auto btn-primary h-11 w-full text-sm"
                    >
                      Re-apply as Mentor
                    </button>
                  </>
                ) : (
                  <div className="flex flex-1 flex-col gap-4">
                    <p className="flex items-center gap-2 rounded-lg border border-amber-400/40 bg-amber-400/10 px-3 py-2 text-xs text-amber-300">
                      <Clock className="h-4 w-4 shrink-0" /> Your application is under review. You'll be a mentor once an admin approves it.
                    </p>
                    <div className="space-y-2">
                      <div>
                        <p className="mb-0.5 text-[11px] font-medium uppercase tracking-wider text-gray-500">Company</p>
                        <p className="text-sm font-semibold text-gray-200">{mentorProfile.company}</p>
                      </div>
                      <div>
                        <p className="mb-0.5 text-[11px] font-medium uppercase tracking-wider text-gray-500">Role / Industry</p>
                        <p className="text-sm font-semibold text-gray-200">{mentorProfile.roleType}</p>
                      </div>
                    </div>
                    <p className="text-[11px] text-gray-500">Submitted {formatDate(mentorProfile.createdAt)}</p>
                  </div>
                )}
              </div>
            ) : (
              <div className="flex flex-1 flex-col">
                <p className="text-sm leading-relaxed text-gray-400">
                  Share your professional journey to guide students and early-career professionals.
                </p>
                <button
                  onClick={openMentorModal}
                  className="mt-auto btn-primary h-11 w-full text-sm"
                >
                  Be a Mentor
                </button>
              </div>
            )}
          </div>
        </section>

        {/* ---- Account card ---- */}
        <section className="card-surface flex h-full flex-col p-6 sm:p-8">
          <h2 className="mb-4 flex items-center gap-2 text-base font-bold text-white">
            <UserIcon className="h-5 w-5 text-brand" /> Account
          </h2>
          <dl className="space-y-3 text-sm">
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
          <div className="mt-6 card-surface p-4">
            <h3 className="mb-2 flex items-center gap-2 text-[13px] font-bold text-white">
              <BookOpen className="h-4 w-4 text-brand" /> AI Scout
            </h3>
            <div className="mb-1.5 flex items-center gap-2">
              <span className="h-2.5 w-2.5 rounded-full bg-brand-solid animate-pulse"></span>
              <span className="text-xs text-gray-400">Actively scanning for matches</span>
            </div>
            <p className="text-xs text-gray-500">
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
            className="relative w-full max-w-lg space-y-5 rounded-2xl border border-white/10 bg-panel bg-gradient-to-b from-white/[0.06] to-transparent p-6 shadow-2xl sm:p-8"
            onClick={e => e.stopPropagation()}
          >
            <button
              onClick={() => !saving && setShowModal(false)}
              className="absolute right-4 top-4 p-1 rounded-lg text-gray-500 transition-colors hover:text-white focus-ring"
              aria-label="Close"
            >
              <X className="h-5 w-5" />
            </button>

            <div>
              <h2 className="text-xl font-bold text-white">Become a Mentor</h2>
              <p className="mt-1 text-sm text-gray-400">
                Your profile will be updated to <span className="font-semibold text-brand">Mentor</span> once registered.
              </p>
            </div>

            <div className="space-y-4">
              <div>
                <label className="mb-1 block text-xs font-medium text-gray-400">Company</label>
                <input
                  value={company}
                  onChange={e => setCompany(e.target.value)}
                  placeholder="e.g. Paystack, KPMG, MTN"
                  className="input-base"
                />
              </div>

              <div>
                <label className="mb-1 block text-xs font-medium text-gray-400">Role / Industry</label>
                <select
                  value={roleType}
                  onChange={e => setRoleType(e.target.value)}
                  className="input-base appearance-none"
                >
                  <option value="" disabled className="bg-panel text-gray-400">
                    Select your industry…
                  </option>
                  {ROLE_OPTIONS.map(opt => (
                    <option key={opt} value={opt} className="bg-panel text-white">
                      {opt}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="mb-1 block text-xs font-medium text-gray-400">
                  How did you get into this industry?
                </label>
                <textarea
                  value={careerStory}
                  onChange={e => setCareerStory(e.target.value)}
                  rows={4}
                  placeholder="Share a brief version of your career journey…"
                  className="w-full resize-none rounded-xl border border-white/10 bg-white/[0.04] px-4 py-3 text-sm text-white placeholder:text-gray-500 transition-all duration-200 focus:border-brand-solid/50 focus:bg-white/[0.06] focus:outline-none focus:ring-2 focus:ring-brand/25"
                />
                <p className="mt-1 text-right text-[11px] text-gray-500 tabular-nums">
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
              className="btn-primary h-11 w-full text-sm"
            >
              {saving && <BreathingLoader size="md" dots={3} />}
              {saving ? 'Registering…' : 'Register as Mentor'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
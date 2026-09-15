import { Bookmark, Send, CalendarClock, CheckCircle2, XCircle, type LucideIcon } from 'lucide-react';
import { apiFetch } from './api';

// Server origin + API root. Override at deploy time with VITE_API_ORIGIN
// (e.g. https://your-api.onrender.com — no trailing slash).
const apiOrigin = (import.meta.env.VITE_API_ORIGIN as string | undefined)?.replace(/\/+$/, '') || 'http://localhost:5000';
export const API_ORIGIN = apiOrigin;
export const API_BASE = `${apiOrigin}/api`;

// Admin-only preview: lets an admin browse the live app while the app is still
// in waitlist mode. Stored per-browser (localStorage) so it only affects that
// admin's own view — it never touches the server, launch state, countdown,
// deadline, or the waitlist itself.
export const ADMIN_PREVIEW_KEY = 'primeopportunity_admin_preview';

export const isAdminPreviewEnabled = (): boolean =>
  typeof localStorage !== 'undefined' && localStorage.getItem(ADMIN_PREVIEW_KEY) === '1';

export const setAdminPreviewEnabled = (enabled: boolean): void => {
  try {
    if (enabled) localStorage.setItem(ADMIN_PREVIEW_KEY, '1');
    else localStorage.removeItem(ADMIN_PREVIEW_KEY);
  } catch {
    /* ignore storage errors */
  }
};

// Launch / waitlist state shared by the home page and admin page.
export interface LaunchStatus {
  launched: boolean;
  launchedAt: string | null;
  welcomeUntil: string | null;
  countdownMs: number;
  deadline: string | null;
  whatsappGroupUrl: string;
  waitlistCount: number;
}

// Shared launch status with a tiny cache + concurrent-dedupe so the home page
// and chat widget don't each hammer /launch/status on every mount.
let launchStatusCache: { at: number; promise: Promise<{ data?: LaunchStatus; ok: boolean }> } | null = null;
const LAUNCH_STATUS_TTL = 30_000;

export async function fetchLaunchStatus(): Promise<{ data?: LaunchStatus; ok: boolean }> {
  const now = Date.now();
  if (launchStatusCache && now - launchStatusCache.at < LAUNCH_STATUS_TTL) {
    return launchStatusCache.promise;
  }
  const promise = (async () => {
    try {
      const res = await fetch(`${API_BASE}/launch/status`);
      const data = await res.json();
      return { data: data as LaunchStatus, ok: !!res.ok };
    } catch {
      return { ok: false };
    }
  })();
  launchStatusCache = { at: now, promise };
  return promise;
}

export interface Opportunity {
  _id: string;
  title: string;
  organization: string;
  category: string;
  location: string;
  deadline: string;
  opportunityType: string;
  tags?: string[];
  officialUrl?: string;
  description?: string;
  [key: string]: any;
}

export type ApplicationStatus = 'saved' | 'applied' | 'interview' | 'accepted' | 'rejected';

export interface ApplicationRecord {
  _id: string;
  opportunityId: string;
  status: ApplicationStatus;
  clicked: boolean;
  clickedAt: string | null;
  dateApplied: string | null;
  updatedAt: string | null;
  opportunity: Opportunity | null;
}

export const STATUSES: ApplicationStatus[] = ['saved', 'applied', 'interview', 'accepted', 'rejected'];

export const STATUS_META: Record<ApplicationStatus, { label: string; icon: LucideIcon; activeClass: string }> = {
  saved: {
    label: 'Saved',
    icon: Bookmark,
    activeClass: 'bg-slate-300/20 text-slate-200 border-slate-300/50',
  },
  applied: {
    label: 'Applied',
    icon: Send,
    activeClass: 'bg-sky-400/20 text-sky-300 border-sky-400/50',
  },
  interview: {
    label: 'Interview',
    icon: CalendarClock,
    activeClass: 'bg-purple-400/20 text-purple-300 border-purple-400/50',
  },
  accepted: {
    label: 'Accepted',
    icon: CheckCircle2,
    activeClass: 'bg-emerald-400/20 text-emerald-300 border-emerald-400/50',
  },
  rejected: {
    label: 'Rejected',
    icon: XCircle,
    activeClass: 'bg-rose-400/20 text-rose-300 border-rose-400/50',
  },
};

export async function fetchApplications(userId: string): Promise<ApplicationRecord[]> {
  const res = await apiFetch(`${API_BASE}/applications?userId=${encodeURIComponent(userId)}`);
  const data = await res.json();
  if (!data.success) throw new Error(data.message || 'Failed to fetch applications');
  return data.data;
}

export async function upsertApplication(
  userId: string,
  opportunityId: string,
  payload: { status?: ApplicationStatus; clicked?: boolean }
): Promise<ApplicationRecord> {
  const res = await apiFetch(`${API_BASE}/applications`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userId, opportunityId, ...payload }),
  });
  const data = await res.json();
  if (!data.success) throw new Error(data.message || 'Failed to update application');
  return data.data;
}
import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ExternalLink, Loader2, MapPin } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import {
  STATUSES,
  STATUS_META,
  fetchApplications,
  upsertApplication,
  type ApplicationRecord,
  type ApplicationStatus,
} from '../lib/applications';

const COLUMN_STYLE: Record<ApplicationStatus, { title: string; panel: string; header: string }> = {
  saved: {
    title: 'Saved / Researching',
    panel: 'bg-white/[0.03] border-white/10',
    header: 'text-slate-300',
  },
  applied: {
    title: 'Applied',
    panel: 'bg-sky-500/10 border-sky-400/20',
    header: 'text-sky-300',
  },
  interview: {
    title: 'Interview / Assessment',
    panel: 'bg-purple-500/10 border-purple-400/20',
    header: 'text-purple-300',
  },
  accepted: {
    title: 'Accepted',
    panel: 'bg-emerald-500/10 border-emerald-400/20',
    header: 'text-emerald-300',
  },
  rejected: {
    title: 'Rejected',
    panel: 'bg-rose-500/10 border-rose-400/20',
    header: 'text-rose-300',
  },
};

const formatDeadline = (dateString: string | null | undefined) => {
  if (!dateString) return 'Deadline not specified';
  const date = new Date(dateString);
  if (isNaN(date.getTime())) return dateString;
  return new Intl.DateTimeFormat('en-US', { year: 'numeric', month: 'short', day: 'numeric' }).format(date);
};

export default function Applications() {
  const { user } = useAuth();
  const [apps, setApps] = useState<ApplicationRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [dragOver, setDragOver] = useState<ApplicationStatus | null>(null);
  const [draggingId, setDraggingId] = useState<string | null>(null);

  const loadApps = useCallback(async () => {
    if (!user) return;
    try {
      setLoading(true);
      setError('');
      const records = await fetchApplications(user.uid);
      setApps(records);
    } catch {
      setError('Failed to load your applications. Please try again.');
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    loadApps();
  }, [loadApps]);

  const moveApplication = async (opportunityId: string, targetStatus: ApplicationStatus) => {
    if (!user) return;
    // Optimistic update so the board feels instant.
    setApps(prev =>
      prev.map(a => (a.opportunityId === opportunityId ? { ...a, status: targetStatus } : a))
    );
    try {
      const updated = await upsertApplication(user.uid, opportunityId, { status: targetStatus });
      setApps(prev => prev.map(a => (a.opportunityId === opportunityId ? updated : a)));
    } catch {
      // Revert to server state on failure.
      await loadApps();
    }
  };

  const handleDrop = (e: React.DragEvent, targetStatus: ApplicationStatus) => {
    e.preventDefault();
    setDragOver(null);
    const oppId = e.dataTransfer.getData('text/oppId');
    const sourceStatus = e.dataTransfer.getData('text/status') as ApplicationStatus | '';
    if (oppId && sourceStatus !== targetStatus) {
      moveApplication(oppId, targetStatus);
    }
  };

  const grouped = STATUSES.map(status => apps.filter(a => a.status === status));

  return (
    <div className="flex flex-col gap-6 pb-10 h-[calc(100vh-8rem)]">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">My Applications</h1>
          <p className="text-muted-foreground mt-1">
            Track your progress and stay on top of deadlines. Drag cards between columns to update their status.
          </p>
        </div>
        <Link
          to="/"
          className="bg-primary text-primary-foreground hover:bg-primary/90 h-10 px-4 py-2 rounded-md font-medium shadow-sm transition-all active:scale-95 inline-flex items-center gap-2 no-underline"
        >
          Discover opportunities
        </Link>
      </div>

      {loading ? (
        <div className="flex-1 flex items-center justify-center text-muted-foreground">
          <Loader2 className="h-6 w-6 animate-spin mr-2" /> Loading your applications...
        </div>
      ) : error ? (
        <div className="flex-1 flex items-center justify-center">
          <p className="text-muted-foreground">{error}</p>
        </div>
      ) : apps.length === 0 ? (
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center space-y-3 border border-dashed border-white/10 rounded-2xl px-10 py-12">
            <p className="text-white font-semibold text-lg">No applications tracked yet</p>
            <p className="text-muted-foreground text-sm">
              Open an opportunity on the dashboard to auto-save it, or pick a status icon on any card.
            </p>
            <Link to="/" className="inline-block bg-primary text-primary-foreground px-5 py-2.5 rounded-lg font-medium hover:bg-primary/90 transition-colors">
              Browse opportunities
            </Link>
          </div>
        </div>
      ) : (
        <div className="flex gap-6 overflow-x-auto pb-4 h-full scrollbar-thin">
          {STATUSES.map((status, colIndex) => {
            const meta = STATUS_META[status];
            const style = COLUMN_STYLE[status];
            const Icon = meta.icon;
            return (
              <div key={status} className={`flex-shrink-0 w-80 rounded-xl border ${style.panel} flex flex-col`}>
                <div className="p-4 border-b bg-background/50 backdrop-blur-sm rounded-t-xl flex justify-between items-center">
                  <h3 className={`font-semibold flex items-center gap-2 ${style.header}`}>
                    <Icon className="h-4 w-4" /> {style.title}
                  </h3>
                  <span className="bg-background text-foreground text-xs font-bold px-2 py-1 rounded-md shadow-sm">
                    {grouped[colIndex].length}
                  </span>
                </div>

                <div
                  onDragOver={(e) => {
                    e.preventDefault();
                    if (dragOver !== status) setDragOver(status);
                  }}
                  onDragLeave={() => {
                    if (dragOver === status) setDragOver(null);
                  }}
                  onDrop={(e) => handleDrop(e, status)}
                  className={`p-3 flex-1 overflow-y-auto space-y-3 rounded-b-xl transition-colors ${
                    dragOver === status ? 'bg-[#84cc16]/10 ring-1 ring-inset ring-[#84cc16]/40' : ''
                  }`}
                >
                  {grouped[colIndex].map(app => (
                    <div
                      key={app._id}
                      draggable
                      onDragStart={(e) => {
                        e.dataTransfer.setData('text/oppId', app.opportunityId);
                        e.dataTransfer.setData('text/status', app.status);
                        setDraggingId(app.opportunityId);
                      }}
                      onDragEnd={() => setDraggingId(null)}
                      className={`bg-card border rounded-lg p-4 shadow-sm hover:shadow-md transition-shadow cursor-grab active:cursor-grabbing ${
                        draggingId === app.opportunityId ? 'opacity-40' : ''
                      }`}
                    >
                      <div className="flex justify-between items-start mb-2">
                        <h4 className="font-bold text-sm leading-tight text-foreground">{app.opportunity?.title || 'Untitled'}</h4>
                        {app.opportunity?.officialUrl && (
                          <a
                            href={app.opportunity.officialUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-muted-foreground hover:text-primary ml-2"
                            title="Open opportunity"
                          >
                            <ExternalLink className="h-4 w-4" />
                          </a>
                        )}
                      </div>
                      <p className="text-xs font-medium text-muted-foreground mb-3">{app.opportunity?.organization || ''}</p>

                      <div className="flex flex-wrap items-center gap-1.5">
                        {app.opportunity?.location && (
                          <span className="inline-flex items-center gap-1 text-[11px] font-medium text-muted-foreground bg-background/60 border border-white/10 px-2 py-0.5 rounded-md">
                            <MapPin className="h-3 w-3" /> {app.opportunity.location}
                          </span>
                        )}
                        <span className="inline-flex items-center gap-1 text-[11px] font-medium text-orange-500 dark:text-orange-400 bg-orange-500/10 dark:bg-orange-950/50 border border-orange-500/20 px-2 py-0.5 rounded-md">
                          ⏳ Due {formatDeadline(app.opportunity?.deadline)}
                        </span>
                      </div>

                      {app.clicked && (
                        <div className="mt-3 inline-flex items-center text-[11px] font-semibold text-[#84cc16] bg-[#84cc16]/10 border border-[#84cc16]/30 px-2 py-0.5 rounded-md">
                          ✓ Visited
                        </div>
                      )}
                    </div>
                  ))}

                  {grouped[colIndex].length === 0 && (
                    <div className="border-2 border-dashed border-muted-foreground/20 rounded-lg h-24 flex items-center justify-center text-muted-foreground/50 text-sm font-medium">
                      Drop here
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
import { useCallback, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { ExternalLink, MapPin } from 'lucide-react';
import { BreathingLoader } from '../components/BreathingLoader';
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

// HTML5 drag and drop doesn't run on touch devices, so cards get a long-press
// gesture instead: hold a card ~250ms to lift it, slide onto a target column,
// and release to move. The page keeps scrolling normally while the finger is
// moving during the initial hold.
const TOUCH_PRESS_MS = 250;
const TOUCH_MOVE_TOLERANCE = 10;
const EDGE_SCROLL_PX = 60;
const EDGE_SCROLL_STEP = 14;

export default function Applications() {
  const { user } = useAuth();
  const [apps, setApps] = useState<ApplicationRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [dragOver, setDragOver] = useState<ApplicationStatus | null>(null);
  const [draggingId, setDraggingId] = useState<string | null>(null);

  // Touch drag state (refs so the once-attached native listeners stay fresh).
  const boardRef = useRef<HTMLDivElement | null>(null);
  const pressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pressStart = useRef<{ x: number; y: number } | null>(null);
  const touchDragActive = useRef(false);
  const touchDragRef = useRef<{ oppId: string; status: ApplicationStatus } | null>(null);
  const dragOverRef = useRef<ApplicationStatus | null>(null);

  const loadApps = useCallback(async () => {
    if (!user) return;
    try {
      setLoading(true);
      setError('');
      const records = await fetchApplications();
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

  const moveApplication = useCallback(async (opportunityId: string, targetStatus: ApplicationStatus) => {
    if (!user) return;
    // Optimistic update so the board feels instant.
    setApps(prev =>
      prev.map(a => (a.opportunityId === opportunityId ? { ...a, status: targetStatus } : a))
    );
    try {
      const updated = await upsertApplication(opportunityId, { status: targetStatus });
      setApps(prev => prev.map(a => (a.opportunityId === opportunityId ? updated : a)));
    } catch {
      // Revert to server state on failure.
      await loadApps();
    }
  }, [user, loadApps]);

  const resolveColumnStatus = (clientX: number, clientY: number): ApplicationStatus | null => {
    const el = document.elementFromPoint(clientX, clientY);
    const column = el?.closest('[data-status]') as HTMLElement | null;
    const ds = column?.dataset.status;
    if (ds && (STATUSES as readonly string[]).includes(ds)) return ds as ApplicationStatus;
    return null;
  };

  // Native touchmove/touchend listeners (passive:false on touchmove) so we can
  // preventDefault once a drag is active and stop the page from scrolling under
  // the finger. Attached once; all mutable state lives in refs.
  useEffect(() => {
    const onTouchMove = (e: TouchEvent) => {
      if (!touchDragActive.current) return;
      e.preventDefault();
      const touch = e.touches[0];
      if (!touch) return;

      const { clientX, clientY } = touch;
      const hovered = resolveColumnStatus(clientX, clientY);
      if (hovered !== dragOverRef.current) {
        dragOverRef.current = hovered;
        setDragOver(hovered);
      }

      // Auto-scroll horizontally when the finger is near the board's edges so
      // off-screen columns can be reached while dragging.
      const board = boardRef.current;
      if (board) {
        const rect = board.getBoundingClientRect();
        if (clientX < rect.left + EDGE_SCROLL_PX) board.scrollLeft -= EDGE_SCROLL_STEP;
        else if (clientX > rect.right - EDGE_SCROLL_PX) board.scrollLeft += EDGE_SCROLL_STEP;
      }

      // Auto-scroll the hovered column vertically near its top/bottom edges.
      const el = document.elementFromPoint(clientX, clientY);
      const column = el?.closest('[data-status]') as HTMLElement | null;
      if (column) {
        const rect = column.getBoundingClientRect();
        if (clientY < rect.top + EDGE_SCROLL_PX) column.scrollTop -= EDGE_SCROLL_STEP;
        else if (clientY > rect.bottom - EDGE_SCROLL_PX) column.scrollTop += EDGE_SCROLL_STEP;
      }
    };

    const onTouchEnd = (e: TouchEvent) => {
      if (!touchDragActive.current) return;
      const touch = e.changedTouches[0];
      const targetStatus = touch ? resolveColumnStatus(touch.clientX, touch.clientY) : null;
      const drag = touchDragRef.current;
      if (drag && targetStatus && targetStatus !== drag.status) {
        moveApplication(drag.oppId, targetStatus);
      }
      touchDragActive.current = false;
      touchDragRef.current = null;
      dragOverRef.current = null;
      setDragOver(null);
      setDraggingId(null);
    };

    const onTouchCancel = () => {
      if (!touchDragActive.current) return;
      touchDragActive.current = false;
      touchDragRef.current = null;
      dragOverRef.current = null;
      setDragOver(null);
      setDraggingId(null);
    };

    document.addEventListener('touchmove', onTouchMove, { passive: false });
    document.addEventListener('touchend', onTouchEnd);
    document.addEventListener('touchcancel', onTouchCancel);
    return () => {
      document.removeEventListener('touchmove', onTouchMove);
      document.removeEventListener('touchend', onTouchEnd);
      document.removeEventListener('touchcancel', onTouchCancel);
    };
  }, [moveApplication]);

  useEffect(() => {
    return () => {
      if (pressTimer.current) clearTimeout(pressTimer.current);
    };
  }, []);

  const beginTouchDrag = (oppId: string, status: ApplicationStatus) => {
    touchDragActive.current = true;
    touchDragRef.current = { oppId, status };
    setDraggingId(oppId);
  };

  const handleTouchStart = (app: ApplicationRecord) => (e: React.TouchEvent) => {
    const touch = e.touches[0];
    pressStart.current = { x: touch.clientX, y: touch.clientY };
    if (pressTimer.current) clearTimeout(pressTimer.current);
    pressTimer.current = setTimeout(() => {
      pressTimer.current = null;
      beginTouchDrag(app.opportunityId, app.status);
    }, TOUCH_PRESS_MS);
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    // Active drags are handled by the native listener above.
    if (touchDragActive.current) return;
    // Moving during the hold means scrolling — cancel the pending press.
    if (!pressStart.current) return;
    const touch = e.touches[0];
    const dx = Math.abs(touch.clientX - pressStart.current.x);
    const dy = Math.abs(touch.clientY - pressStart.current.y);
    if (dx > TOUCH_MOVE_TOLERANCE || dy > TOUCH_MOVE_TOLERANCE) {
      if (pressTimer.current) clearTimeout(pressTimer.current);
      pressTimer.current = null;
      pressStart.current = null;
    }
  };

  const handleTouchEnd = () => {
    // The native touchend performs the actual drop if a drag was active.
    if (pressTimer.current) {
      clearTimeout(pressTimer.current);
      pressTimer.current = null;
    }
    pressStart.current = null;
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
    <div className="flex flex-col gap-6 pb-10 h-[calc(100vh-8rem)] min-w-0">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between min-w-0">
        <div className="min-w-0">
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-white">My Applications</h1>
          <p className="text-sm sm:text-base text-gray-400 leading-relaxed mt-1">
            Track your progress and stay on top of deadlines. Drag cards between columns to update their status.
          </p>
        </div>
        <Link
          to="/"
          className="btn-primary h-11 px-5 text-sm no-underline shrink-0"
        >
          Discover opportunities
        </Link>
      </div>

      {loading ? (
        <div className="flex-1 flex items-center justify-center text-gray-400">
          <BreathingLoader size="lg" dots={3} label="Loading your applications..." />
        </div>
      ) : error ? (
        <div className="flex-1 flex items-center justify-center">
          <p className="text-gray-400">{error}</p>
        </div>
      ) : apps.length === 0 ? (
        <div className="flex-1 flex items-center justify-center">
          <div className="card-surface text-center space-y-4 px-8 py-12 sm:px-10 sm:py-16 max-w-sm">
            <p className="text-white font-semibold text-lg">No applications tracked yet</p>
            <p className="text-gray-400 text-sm leading-relaxed">
              Open an opportunity on the dashboard to auto-save it, or pick a status icon on any card.
            </p>
            <Link to="/" className="btn-primary h-11 px-6 text-sm no-underline inline-flex">
              Browse opportunities
            </Link>
          </div>
        </div>
      ) : (
        <div ref={boardRef} className="flex gap-4 sm:gap-6 overflow-x-auto pb-4 min-h-0 flex-1 scrollbar-thin">
          {STATUSES.map((status, colIndex) => {
            const meta = STATUS_META[status];
            const style = COLUMN_STYLE[status];
            const Icon = meta.icon;
            return (
              <div key={status} className={`flex-shrink-0 w-72 sm:w-80 rounded-2xl border ${style.panel} flex flex-col min-w-0`}>
                <div className="p-4 border-b border-white/10 bg-white/[0.04] rounded-t-2xl flex justify-between items-center">
                  <h3 className={`font-semibold text-sm flex items-center gap-2 ${style.header}`}>
                    <Icon className="h-4 w-4 shrink-0" /> {style.title}
                  </h3>
                  <span className="text-gray-400 tabular-nums text-xs font-bold px-2 py-1 rounded-lg bg-white/[0.06] border border-white/10 shadow-sm">
                    {grouped[colIndex].length}
                  </span>
                </div>

                <div
                  data-status={status}
                  onDragOver={(e) => {
                    e.preventDefault();
                    if (dragOver !== status) setDragOver(status);
                  }}
                  onDragLeave={() => {
                    if (dragOver === status) setDragOver(null);
                  }}
                  onDrop={(e) => handleDrop(e, status)}
                  className={`p-3 flex-1 overflow-y-auto space-y-3 rounded-b-2xl transition-colors ${
                    dragOver === status ? 'bg-brand/10 ring-1 ring-inset ring-brand/40' : ''
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
                      onTouchStart={handleTouchStart(app)}
                      onTouchMove={handleTouchMove}
                      onTouchEnd={handleTouchEnd}
                      onContextMenu={(e) => e.preventDefault()}
                      className={`card-surface p-4 cursor-grab active:cursor-grabbing select-none touch-callout-none ${
                        draggingId === app.opportunityId ? 'opacity-40' : ''
                      }`}
                    >
                      <div className="flex justify-between items-start mb-2 gap-2">
                        <h4 className="font-bold text-sm leading-tight text-white min-w-0">{app.opportunity?.title || 'Untitled'}</h4>
                        {app.opportunity?.officialUrl && (
                          <a
                            href={app.opportunity.officialUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-gray-400 hover:text-lime-400 transition-colors focus-ring rounded-md shrink-0"
                            title="Open opportunity"
                          >
                            <ExternalLink className="h-4 w-4" />
                          </a>
                        )}
                      </div>
                      <p className="text-xs font-medium text-gray-500 mb-3">{app.opportunity?.organization || ''}</p>

                      <div className="flex flex-wrap items-center gap-1.5">
                        {app.opportunity?.location && (
                          <span className="inline-flex items-center gap-1 text-[11px] font-medium text-gray-400 bg-white/[0.04] border border-white/10 px-2 py-0.5 rounded-md">
                            <MapPin className="h-3 w-3 shrink-0" /> {app.opportunity.location}
                          </span>
                        )}
                        <span className="inline-flex items-center gap-1 text-[11px] font-medium text-orange-500 dark:text-orange-400 bg-orange-500/10 dark:bg-orange-950/50 border border-orange-500/20 px-2 py-0.5 rounded-md">
                          ⏳ Due {formatDeadline(app.opportunity?.deadline)}
                        </span>
                      </div>

                      {app.clicked && (
                        <div className="mt-3 inline-flex items-center text-[11px] font-semibold text-brand bg-brand/10 border border-brand-solid/30 px-2 py-0.5 rounded-md">
                          ✓ Visited
                        </div>
                      )}
                    </div>
                  ))}

                  {grouped[colIndex].length === 0 && (
                    <div className="border-2 border-dashed border-white/10 rounded-xl h-24 flex items-center justify-center text-gray-500 text-sm font-medium">
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
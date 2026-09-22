import { useEffect, useRef, useState, useCallback } from 'react';
import { Phone, Mic, MicOff, Volume2, VolumeX, Bot } from 'lucide-react';
import { BreathingLoader } from './BreathingLoader';
import { useAuth } from '../context/AuthContext';
import { API_BASE } from '../lib/applications';
import { apiFetch } from '../lib/api';

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

interface CallWidgetProps {
  initialHistory: ChatMessage[];
  onHistoryChange?: (history: ChatMessage[]) => void;
  onEnd: () => void;
}

type CallStatus = 'ringing' | 'connected' | 'thinking' | 'speaking' | 'ended';

const API_URL = `${API_BASE}/ai/chat`;

const STATUS_TEXT: Record<CallStatus, string> = {
  ringing: 'Ringing…',
  connected: 'Connected · listening for you',
  thinking: 'Thinking…',
  speaking: 'AI speaking',
  ended: 'Call ended',
};

export default function CallWidget({ initialHistory, onHistoryChange, onEnd }: CallWidgetProps) {
  const { user } = useAuth();

  const [status, setStatus] = useState<CallStatus>('ringing');
  const [turns, setTurns] = useState<ChatMessage[]>(() =>
    initialHistory.length > 8 ? initialHistory.slice(-8) : initialHistory
  );
  const [interim, setInterim] = useState('');
  const [elapsedSec, setElapsedSec] = useState(0);
  const [muted, setMuted] = useState(false);
  const [micBlocked, setMicBlocked] = useState(false);

  const statusRef = useRef<CallStatus>('ringing');
  const historyRef = useRef<ChatMessage[]>(initialHistory.length > 12 ? initialHistory.slice(-12) : initialHistory);
  const pendingRef = useRef<string[]>([]);
  const recognitionRef = useRef<any>(null);
  const silenceTimerRef = useRef<number | null>(null);
  const dispatchingRef = useRef(false);
  // Tracks whether the component is still mounted so async callbacks scheduled
  // by the speech engine (resumeAfterReply, recognition restart timers) can bail
  // out instead of re-creating the mic instance after the widget unmounts.
  const mountedRef = useRef(true);

  const setStatusBoth = useCallback((s: CallStatus) => {
    statusRef.current = s;
    setStatus(s);
  }, []);

  const pushTurn = useCallback((turn: ChatMessage) => {
    historyRef.current = [...historyRef.current, turn];
    setTurns(prev => [...prev, turn]);
  }, []);

  const clearSilenceTimer = () => {
    if (silenceTimerRef.current !== null) {
      window.clearTimeout(silenceTimerRef.current);
      silenceTimerRef.current = null;
    }
  };

  // ---------- Speech synthesis ----------
  const pickVoice = (): SpeechSynthesisVoice | null => {
    const voices = window.speechSynthesis.getVoices();
    const en = voices.filter(v => v.lang.toLowerCase().startsWith('en'));
    const preferred =
      en.find(v => /natural|neural|online/i.test(v.name)) ||
      en.find(v => v.localService && /female|aria|jenny|zira|samantha|google/i.test(v.name));
    return preferred || en.find(v => v.localService) || en[0] || null;
  };

  useEffect(() => {
    window.speechSynthesis.getVoices();
    const handler = () => window.speechSynthesis.getVoices();
    window.speechSynthesis.addEventListener?.('voiceschanged', handler);
    return () => window.speechSynthesis.removeEventListener?.('voiceschanged', handler);
  }, []);

  const speakReply = (text: string) => {
    if (muted || !window.speechSynthesis) return;
    window.speechSynthesis.cancel();
    const sentences = (text.match(/[^.!?]+[.!?]+["')\]]*\s*|[^.!?]+$/g) || [])
      .map(s => s.trim())
      .filter(Boolean);
    const chunks = sentences.length > 0 ? sentences : [text];
    const utterances = chunks.map(chunk => {
      const utter = new SpeechSynthesisUtterance(chunk);
      utter.voice = pickVoice();
      utter.rate = 1.04;
      utter.pitch = 1;
      return utter;
    });
    const last = utterances[utterances.length - 1];
    utterances.forEach(u => window.speechSynthesis.speak(u));
    last.onend = resumeAfterReply;
    last.onerror = resumeAfterReply;
  };

  const stopSpeaking = () => window.speechSynthesis?.cancel();

  const resumeAfterReply = () => {
    if (!mountedRef.current) return;
    setStatusBoth('connected');
    if (!muted && !micBlocked) startListening();
  };

  // ---------- Speech recognition ----------
  const startListening = () => {
    if (!mountedRef.current) return;
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SR || statusRef.current === 'ended' || dispatchingRef.current || micBlocked) return;

    try {
      const rec = new SR();
      rec.lang = 'en-US';
      rec.continuous = true;
      rec.interimResults = true;
      rec.maxAlternatives = 1;

      rec.onresult = (event: any) => {
        let finalText = '';
        for (let i = event.resultIndex; i < event.results.length; i++) {
          const result = event.results[i];
          if (result.isFinal) {
            finalText = result[0].transcript;
            pendingRef.current.push(finalText);
            setInterim('');
          } else {
            setInterim(result[0].transcript);
          }
        }
        clearSilenceTimer();
        if (pendingRef.current.length > 0 || finalText) {
          silenceTimerRef.current = window.setTimeout(() => {
            if (pendingRef.current.length > 0) dispatchSpeech();
          }, 1700);
        }
      };

      rec.onend = () => {
        if (statusRef.current === 'ended' || dispatchingRef.current) return;
        if (pendingRef.current.length > 0) {
          dispatchSpeech();
        } else {
          window.setTimeout(() => {
            if (!mountedRef.current) return;
            if (statusRef.current === 'connected' && !micBlocked) {
              try {
                recognitionRef.current?.start();
              } catch {
                /* already running */
              }
            }
          }, 350);
        }
      };

      rec.onerror = (event: any) => {
        if (event.error === 'not-allowed' || event.error === 'service-not-allowed') {
          setMicBlocked(true);
          pushTurn({
            role: 'assistant',
            content: 'Microphone access was blocked. Allow mic permission and try again.',
          });
        }
      };

      recognitionRef.current = rec;
      rec.start();
    } catch {
      setMicBlocked(true);
    }
  };

  const dispatchSpeech = () => {
    if (dispatchingRef.current) return;
    clearSilenceTimer();
    const message = pendingRef.current.join(' ').trim();
    pendingRef.current = [];
    setInterim('');
    if (!message) return;

    dispatchingRef.current = true;
    setStatusBoth('thinking');
    try {
      recognitionRef.current?.stop();
    } catch {
      /* ignore */
    }

    historyRef.current = [...historyRef.current, { role: 'user', content: message }];
    setTurns(prev => [...prev, { role: 'user', content: message }]);
    void sendToAI(message);
  };

  const sendToAI = async (message: string) => {
    const apiHistory = historyRef.current
      .slice(0, -1)
      .slice(-10)
      .map(m => ({ role: m.role, content: m.content }));

    try {
      const res = await apiFetch(API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message, history: apiHistory }),
      });
      const data = await res.json();

      if (data.success && typeof data.reply === 'string') {
        pushTurn({ role: 'assistant', content: data.reply });
        if (muted || !window.speechSynthesis) {
          setStatusBoth('connected');
          window.setTimeout(() => {
            if (!micBlocked) startListening();
          }, 600);
        } else {
          setStatusBoth('speaking');
          speakReply(data.reply);
        }
      } else {
        pushTurn({ role: 'assistant', content: 'Sorry, I could not process that. Please try again.' });
        finishTurn();
      }
    } catch {
      pushTurn({
        role: 'assistant',
        content: 'I am having trouble connecting to the server. Please try again.',
      });
      finishTurn();
    } finally {
      dispatchingRef.current = false;
    }
  };

  const finishTurn = () => {
    window.setTimeout(() => {
      setStatusBoth('connected');
      if (!micBlocked) startListening();
    }, 600);
  };

  // ---------- Lifecycle ----------
  useEffect(() => {
    const ringTimer = window.setTimeout(() => {
      setStatusBoth('connected');
      startListening();
    }, 1600);
    return () => window.clearTimeout(ringTimer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (status === 'ended') return;
    const interval = window.setInterval(() => setElapsedSec(s => s + 1), 1000);
    return () => window.clearInterval(interval);
  }, [status]);

  useEffect(() => {
    return () => {
      // Guaranteed cleanup on ANY unmount (not just the End-call button) so the
      // native speech recognition instance is fully stopped/aborted and the mic
      // is released. speechSynthesis is cancelled too so no utterance keeps
      // playing after the widget closes.
      mountedRef.current = false;
      stopSpeaking();
      clearSilenceTimer();
      try {
        recognitionRef.current?.abort();
      } catch {
        /* ignore */
      }
      recognitionRef.current = null;
    };
  }, []);

  const handleEnd = () => {
    stopSpeaking();
    clearSilenceTimer();
    dispatchingRef.current = true;
    try {
      recognitionRef.current?.abort();
    } catch {
      /* ignore */
    }
    recognitionRef.current = null;
    setStatusBoth('ended');
    onHistoryChange?.(historyRef.current.slice(-30));
    window.setTimeout(() => onEnd(), 700);
  };

  const toggleMute = () => {
    setMuted(prev => {
      const next = !prev;
      if (next) {
        stopSpeaking();
        clearSilenceTimer();
        pendingRef.current = [];
      }
      return next;
    });
  };

  const mm = String(Math.floor(elapsedSec / 60)).padStart(2, '0');
  const ss = String(elapsedSec % 60).padStart(2, '0');
  const isListening = status === 'connected' && !micBlocked;
  const lastTurns = turns.slice(-6);

  return (
    <>
      <div className="fixed inset-0 z-[110] flex items-center justify-center bg-canvas text-white">
        {/* Background glow */}
        <div className="absolute inset-0 bg-gradient-to-b from-white/[0.06] to-transparent"></div>
        <div className="absolute -top-32 left-1/2 h-96 w-96 -translate-x-1/2 rounded-full bg-brand/15 blur-3xl"></div>
        <div className="absolute bottom-0 right-0 h-72 w-72 rounded-full bg-indigo-500/10 blur-3xl"></div>

        <div className="relative flex h-full w-full max-w-md flex-col items-center px-6 py-8 overflow-hidden fade-in-call">
          {/* Top status bar */}
          <div className="flex w-full items-center justify-between text-[11px] text-white/60">
            <span className="flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full bg-brand-solid animate-pulse"></span>
              On call
            </span>
            <span className="tabular-nums">
              {mm}:{ss}
            </span>
          </div>

          {/* Avatar */}
          <div className="mt-8 flex flex-col items-center">
            <div className="relative flex h-28 w-28 items-center justify-center">
              {isListening && (
                <>
                  <span className="absolute inset-0 rounded-full bg-brand/30 animate-ping"></span>
                  <span className="absolute inset-0 rounded-full bg-brand/20 animate-ping" style={{ animationDelay: '0.5s' }}></span>
                </>
              )}
              {status === 'speaking' && (
                <>
                  <span className="absolute inset-0 rounded-full bg-indigo-500/30 animate-ping"></span>
                  <span className="absolute inset-0 rounded-full bg-indigo-500/20 animate-ping" style={{ animationDelay: '0.4s' }}></span>
                </>
              )}
              <div
                className={`relative flex h-28 w-28 items-center justify-center rounded-full bg-gradient-to-br from-indigo-500 via-purple-500 to-brand border-4 border-white/10 shadow-[0_0_40px_rgba(132,204,22,0.35)] ${
                  status === 'speaking' ? 'talk-glow' : ''
                }`}
              >
                <Bot className="h-14 w-14 text-[#fff]" />
              </div>
            </div>
            <h2 className="mt-5 text-xl font-bold">PrimeOpportunity AI</h2>
            <p className="text-[12px] text-white/60">Career Advisor · RAG-powered</p>

            {/* Status line */}
            <div className="mt-3 flex items-center gap-2 text-[12px] text-white/70">
              {status === 'thinking' && <BreathingLoader size="sm" dots={3} />}
              {isListening && (
                <span className="flex items-end gap-0.5" aria-hidden>
                  <span className="eq-bar h-2 w-0.5 rounded bg-brand-solid"></span>
                  <span className="eq-bar h-3 w-0.5 rounded bg-brand-solid" style={{ animationDelay: '0.15s' }}></span>
                  <span className="eq-bar h-1.5 w-0.5 rounded bg-brand-solid" style={{ animationDelay: '0.3s' }}></span>
                  <span className="eq-bar h-2.5 w-0.5 rounded bg-brand-solid" style={{ animationDelay: '0.45s' }}></span>
                </span>
              )}
              <span>{micBlocked ? 'Mic blocked — please allow access' : STATUS_TEXT[status]}</span>
              <span className="text-white/50">· {muted ? 'Muted' : 'Hands-free'}</span>
            </div>
          </div>

          {/* Live captions / transcript */}
          <div className="mt-8 w-full flex-1 min-h-0 space-y-2.5 overflow-y-auto py-2 pr-1">
            {lastTurns.length === 0 && (
              <p className="text-center text-[12px] text-white/50">
                Just speak — ask about internships, scholarships, or your CV matches.
              </p>
            )}
            {lastTurns.map((t, idx) =>
              t.role === 'user' ? (
                <div key={`u-${idx}`} className="w-full rounded-2xl rounded-br-sm bg-brand-solid px-3.5 py-2.5 text-[13px] font-medium text-[#070e0a]">
                  {t.content}
                </div>
              ) : (
                <div key={`a-${idx}`} className="w-full rounded-2xl rounded-bl-sm border border-white/10 bg-white/[0.07] px-3.5 py-2.5 text-[13px] leading-relaxed text-gray-200">
                  {t.content}
                </div>
              )
            )}
            {interim && (
              <p className="text-[12px] italic text-gray-400">
                <Mic className="mr-1 inline h-3 w-3 text-brand" />
                {interim}
              </p>
            )}
            {status === 'speaking' && (
              <div className="flex items-center gap-2 text-[12px] text-indigo-300">
                <span className="flex items-end gap-0.5" aria-hidden>
                  <span className="eq-bar h-2 w-0.5 rounded bg-indigo-400"></span>
                  <span className="eq-bar h-3 w-0.5 rounded bg-indigo-400" style={{ animationDelay: '0.2s' }}></span>
                  <span className="eq-bar h-1.5 w-0.5 rounded bg-indigo-400" style={{ animationDelay: '0.35s' }}></span>
                </span>
                Speaking…
              </div>
            )}
          </div>

          {/* Controls */}
          <div className="mt-4 flex w-full items-center justify-center gap-8 pb-2">
            <button
              onClick={toggleMute}
              aria-label={muted ? 'Unmute' : 'Mute'}
              className="flex h-14 w-14 items-center justify-center rounded-full border border-white/15 bg-white/10 text-white transition-all hover:bg-white/20 active:scale-90"
            >
              {muted ? <VolumeX className="h-6 w-6" /> : <Volume2 className="h-6 w-6" />}
            </button>
            <button
              onClick={handleEnd}
              aria-label="End call"
              className="flex h-16 w-16 items-center justify-center rounded-full bg-red-500 text-white shadow-[0_0_30px_rgba(239,68,68,0.4)] transition-all hover:bg-red-400 active:scale-90"
            >
              <Phone className="h-7 w-7" />
            </button>
            <div
              className="flex h-14 w-14 items-center justify-center rounded-full border border-white/15 bg-white/10 text-white/70"
              aria-label="Microphone status"
            >
              {micBlocked ? <MicOff className="h-6 w-6" /> : <Mic className="h-6 w-6" />}
            </div>
          </div>

          <p className="mt-1 text-[10px] text-white/35">
            Speak naturally — silence auto-sends. AI may make mistakes.
          </p>
        </div>
      </div>

      <style>{`
        @keyframes fadeInCall {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        .fade-in-call { animation: fadeInCall 0.25s ease-out; }

        @keyframes eqBounce {
          0%, 100% { transform: scaleY(0.5); }
          50% { transform: scaleY(1); }
        }
        .eq-bar { transform-origin: bottom; animation: eqBounce 0.9s ease-in-out infinite; }

        @keyframes talkGlow {
          0%, 100% { box-shadow: 0 0 40px rgba(132, 204, 22, 0.35), 0 0 80px rgba(99, 102, 241, 0.25); }
          50% { box-shadow: 0 0 60px rgba(132, 204, 22, 0.6), 0 0 110px rgba(99, 102, 241, 0.4); }
        }
        .talk-glow { animation: talkGlow 1.4s ease-in-out infinite; }
      `}</style>
    </>
  );
}
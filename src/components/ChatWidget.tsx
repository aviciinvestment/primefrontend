import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { MessageCircle, X, Send, Bot, User as UserIcon, Phone, ArrowRight } from 'lucide-react';
import { BreathingLoader } from './BreathingLoader';
import { useAuth } from '../context/AuthContext';
import { API_BASE, fetchLaunchStatus, isAdminPreviewEnabled } from '../lib/applications';
import { apiFetch } from '../lib/api';
import CallWidget from './CallWidget';
import MarkdownView from './MarkdownView';

interface ChatAction {
  type: 'mentorship';
}

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  action?: ChatAction;
}

const WELCOME_MESSAGE: ChatMessage = {
  role: 'assistant',
  content:
    "Hi! I'm PrimeOpportunity AI, your career assistant.\n\nI can help you find scholarships, internships, graduate programmes, and fellowships on our platform. Just ask me anything, e.g. *\"show me engineering internships in Lagos\"* or *\"scholarships for recent graduates\"*.",
};

export default function ChatWidget() {
  const { user, isAdmin } = useAuth();
  const navigate = useNavigate();
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  // Live progress shown while waiting: completed steps (from the worker's
  // {type:'status'} frames) plus the current one, so the user is carried along.
  const [progressSteps, setProgressSteps] = useState<string[]>([]);
  const [progressNote, setProgressNote] = useState('Preparing your message...');
  const [showCall, setShowCall] = useState(false);
  // Chat is only available once the app has launched — unless an admin is
  // previewing the app while it is still in waitlist mode.
  const adminPreview = isAdmin && isAdminPreviewEnabled();
  const [launched, setLaunched] = useState(true);

  useEffect(() => {
    let cancelled = false;
    fetchLaunchStatus()
      .then(r => { if (!cancelled) setLaunched(!!r.ok && !!r.data?.launched); })
      .catch(() => { if (!cancelled) setLaunched(true); });
    return () => { cancelled = true; };
  }, []);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);

  // Chat can be served by the Cloudflare Worker (free SSE) — set VITE_AI_CHAT_URL
  // to its URL; otherwise it falls back to the Express backend's /ai/chat.
  const AI_CHAT_URL =
    (import.meta.env.VITE_AI_CHAT_URL as string | undefined)?.trim() || `${API_BASE}/ai/chat`;
  const API_URL = AI_CHAT_URL;

  // Open panel → seed welcome message once
  const handleOpen = () => {
    setIsOpen(prev => {
      if (!prev && messages.length === 0) {
        setMessages([WELCOME_MESSAGE]);
      }
      return !prev;
    });
  };

  // Auto-scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isLoading, isOpen]);

  // Focus input when panel opens
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [isOpen]);

  // Close on Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setIsOpen(false);
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  const handleSend = async () => {
    const message = input.trim();
    if (!message || isLoading) return;

    if (!messages.some(m => m.role === 'assistant' && m.content === WELCOME_MESSAGE.content)) {
      setMessages(prev => [...prev, WELCOME_MESSAGE]);
    }

    const userMessage: ChatMessage = { role: 'user', content: message };
    const updated = [...messages, userMessage];
    setMessages(updated);
    setInput('');
    setIsLoading(true);
    setProgressSteps([]);
    setProgressNote('Preparing your message...');

    // Build history from the last 10 messages before the new user message
    const history = updated.slice(-10).map(m => ({ role: m.role, content: m.content }));

    try {
      const res = await apiFetch(API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message, history, stream: true, userName: user?.displayName || undefined }),
      });

      const contentType = res.headers.get('content-type') || '';
      if (contentType.includes('text/event-stream')) {
        const reader = res.body?.getReader();
        if (!reader) throw new Error('No response body');

        // Reserve the assistant slot the stream will fill.
        setMessages(prev => {
          const copy = [...prev];
          const last = copy[copy.length - 1];
          if (last && last.role === 'assistant') {
            copy[copy.length - 1] = { ...last, content: '' };
          } else {
            copy.push({ role: 'assistant', content: '' });
          }
          return copy;
        });

        const decoder = new TextDecoder();
        let buffer = '';
        let swallowed = false;

        while (true) {
          const { value, done } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });

          let newlineIdx;
          while ((newlineIdx = buffer.indexOf('\n\n')) !== -1) {
            const rawEvent = buffer.slice(0, newlineIdx);
            buffer = buffer.slice(newlineIdx + 2);
            const dataLine = rawEvent.split('\n').find(l => l.startsWith('data: '));
            if (!dataLine) continue;
            const payload = dataLine.slice(6).trim();
            if (!payload) continue;

            let parsed: { type: string; text?: string; reply?: string; action?: ChatAction; step?: string };
            try {
              parsed = JSON.parse(payload);
            } catch {
              continue;
            }

            if (parsed.type === 'status' && typeof parsed.step === 'string') {
              // Worker tick: show the real current step, keep completed ones in
              // order so the user sees exactly what the assistant is doing.
              const step = parsed.step;
              setProgressNote(step);
              setProgressSteps(prev => (prev.includes(step) ? prev : [...prev, step]));
            } else if (parsed.type === 'delta' && typeof parsed.text === 'string') {
              swallowed = true;
              const chunk = parsed.text;
              setMessages(prev => {
                const copy = [...prev];
                const last = copy[copy.length - 1];
                if (last && last.role === 'assistant') {
                  copy[copy.length - 1] = { ...last, content: last.content + chunk };
                } else {
                  copy.push({ role: 'assistant', content: chunk });
                }
                return copy;
              });
            } else if (parsed.type === 'done' && typeof parsed.reply === 'string') {
              swallowed = true;
              setMessages(prev => {
                const copy = [...prev];
                const last = copy[copy.length - 1];
                if (last && last.role === 'assistant') {
                  copy[copy.length - 1] = { ...last, content: parsed.reply!, action: parsed.action };
                } else {
                  copy.push({ role: 'assistant', content: parsed.reply!, action: parsed.action });
                }
                return copy;
              });
            } else if (parsed.type === 'error') {
              swallowed = false;
              setMessages(prev => {
                const copy = [...prev];
                const last = copy[copy.length - 1];
                if (last && last.role === 'assistant' && !last.content) {
                  copy[copy.length - 1] = {
                    ...last,
                    content: 'Sorry, I could not process that. Please try again.',
                  };
                }
                return copy;
              });
            }
          }
        }

        // Stream ended with no frames — flag it as a failure without a stray empty bubble.
        if (!swallowed) {
          setMessages(prev => {
            const copy = [...prev];
            const last = copy[copy.length - 1];
            if (last && last.role === 'assistant' && !last.content) {
              copy[copy.length - 1] = { ...last, content: 'Sorry, I could not process that. Please try again.' };
            }
            return copy;
          });
        }
      } else {
        const data = await res.json();
        if (data.success && typeof data.reply === 'string') {
          setMessages(prev => [
            ...prev,
            { role: 'assistant', content: data.reply, action: data.action },
          ]);
        } else {
          setMessages(prev => [
            ...prev,
            { role: 'assistant', content: 'Sorry, I could not process that. Please try again.' },
          ]);
        }
      }
    } catch {
      setMessages(prev => {
        const copy = [...prev];
        const last = copy[copy.length - 1];
        if (last && last.role === 'assistant') {
          copy[copy.length - 1] = {
            ...last,
            content: 'Sorry, I am having trouble connecting right now. Please check that the server is running and try again.',
          };
        } else {
          copy.push({
            role: 'assistant',
            content:
              'Sorry, I am having trouble connecting right now. Please check that the server is running and try again.',
          });
        }
        return copy;
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  // Signed-out visitors don't get the chat launcher at all — the assistant is
  // for members. On top of that, chat only appears once the app has launched
  // (unless an admin is previewing while the app is still in waitlist mode).
  if (!user || (!launched && !adminPreview)) return null;

  return (
    <>
      {/* Floating Chat Button */}
      <button
        onClick={handleOpen}
        aria-label="Open AI chat assistant"
        className={`fixed bottom-5 right-5 sm:bottom-6 sm:right-6 z-[90] flex items-center justify-center rounded-full shadow-[0_0_25px_rgba(132,204,22,0.45)] transition-all duration-300 hover:scale-110 active:scale-95 ${
          isOpen ? 'w-12 h-12 bg-white/10 border border-white/20' : 'w-14 h-14 bg-[#84cc16] text-[#070e0a]'
        }`}
      >
        {isOpen ? (
          <X className="h-6 w-6 text-white" />
        ) : (
          <>
            <span className="absolute inset-0 rounded-full bg-[#84cc16] opacity-40 animate-ping pointer-events-none"></span>
            <MessageCircle className="h-7 w-7 relative" />
          </>
        )}
      </button>

      {/* Chat Panel */}
      {isOpen && (
        <div className="fixed bottom-20 right-4 sm:bottom-24 sm:right-6 z-[95] flex flex-col overflow-hidden rounded-2xl border border-white/10 bg-[#0d1410]/[0.98] backdrop-blur-md shadow-2xl w-[calc(100vw-2rem)] sm:w-[400px] h-[70vh] sm:h-[560px] max-h-[75vh] fade-in-slide-up">
          
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3.5 border-b border-white/10 bg-gradient-to-br from-indigo-500 via-purple-500 to-primary">
            <div className="flex items-center gap-3">
              <div className="relative flex h-9 w-9 items-center justify-center rounded-full bg-white/15 border border-white/20">
                <Bot className="h-5 w-5 text-white" />
                <span className="absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full bg-[#84cc16] border-2 border-[#070e0a]"></span>
              </div>
              <div>
                <h3 className="text-sm font-bold text-white leading-tight">PrimeOpportunity AI</h3>
                <p className="text-[11px] text-white/70 leading-tight">Career Advisor • RAG-powered</p>
              </div>
            </div>
            <div className="flex items-center gap-1">
              <button
                onClick={() => setShowCall(true)}
                aria-label="Voice call with AI"
                title="Voice call"
                className="p-1.5 rounded-lg text-white/80 hover:text-white hover:bg-white/10 transition-colors"
              >
                <Phone className="h-5 w-5" />
              </button>
              <button
                onClick={() => setIsOpen(false)}
                aria-label="Close chat"
                className="p-1.5 rounded-lg text-white/80 hover:text-white hover:bg-white/10 transition-colors"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
          </div>

          {/* Messages */}
          <div
            ref={messagesContainerRef}
            className="flex-1 overflow-y-auto px-4 py-4 space-y-4 scroll-smooth"
          >
            {messages.map((msg, idx) => (
              <div
                key={idx}
                className={`flex items-end gap-2 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                {msg.role === 'assistant' && (
                  <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-indigo-500 via-purple-500 to-primary">
                    <Bot className="h-4 w-4 text-white" />
                  </div>
                )}
                <div
                  className={`max-w-[80%] rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed whitespace-pre-wrap break-words ${
                    msg.role === 'user'
                      ? 'bg-[#84cc16] text-[#070e0a] font-medium rounded-br-sm'
                      : 'bg-white/[0.06] border border-white/10 text-gray-200 rounded-bl-sm'
                  }`}
                >
                  {msg.role === 'assistant' ? <MarkdownView text={msg.content} /> : msg.content}
                  {msg.action?.type === 'mentorship' && (
                    <button
                      onClick={() => navigate('/mentorship/interest')}
                      className="mt-2.5 flex w-full items-center justify-center gap-1.5 rounded-xl bg-[#84cc16] px-3.5 py-2 text-[13px] font-bold text-[#070e0a] shadow-[0_0_15px_rgba(132,204,22,0.35)] transition-all hover:scale-[1.02] hover:bg-[#a3e635] active:scale-95"
                    >
                      Get Mentorship Guidance <ArrowRight className="h-4 w-4" />
                    </button>
                  )}
                </div>
                {msg.role === 'user' && (
                  <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#84cc16]/20 border border-[#84cc16]/40 text-[#84cc16]">
                    {user?.displayName?.[0]?.toUpperCase() || <UserIcon className="h-4 w-4" />}
                  </div>
                )}
              </div>
            ))}

            {isLoading && (
              <div className="flex items-end gap-2 justify-start">
                <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-indigo-500 via-purple-500 to-primary">
                  <Bot className="h-4 w-4 text-white" />
                </div>
                <div className="rounded-2xl rounded-bl-sm bg-white/[0.06] border border-white/10 px-4 py-3">
                  <div className="flex items-center gap-1.5">
                    <BreathingLoader size="sm" dots={3} />
                    <span className="text-sm text-gray-300">{progressNote}</span>
                  </div>
                  {progressSteps.length > 1 && (
                    <div className="mt-1.5 flex flex-col gap-0.5 border-t border-white/10 pt-1.5">
                      {progressSteps.slice(0, -1).map(step => (
                        <span key={step} className="text-[11px] leading-snug text-gray-400">
                          {step}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Input */}
          <div className="border-t border-white/10 p-3 bg-[#0d1410]/80">
            <div className="flex items-center gap-2">
              <input
                ref={inputRef}
                type="text"
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Ask about scholarships, internships..."
                disabled={isLoading}
                className="flex-1 h-11 rounded-xl border border-white/10 bg-white/5 px-4 text-sm text-white placeholder:text-gray-500 focus:outline-none focus:border-[#84cc16]/60 focus:ring-1 focus:ring-[#84cc16]/40 disabled:opacity-60 transition-colors"
              />
              <button
                onClick={handleSend}
                disabled={isLoading || !input.trim()}
                aria-label="Send message"
                className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[#84cc16] text-[#070e0a] transition-all shadow-[0_0_15px_rgba(132,204,22,0.3)] ${
                  isLoading ? 'btn-busy cursor-wait' : 'hover:bg-[#84cc16]/90 active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed'
                }`}
              >
                {isLoading ? <BreathingLoader size="md" dots={3} tone="dark" /> : <Send className="h-5 w-5" />}
              </button>
            </div>
            {user && (
              <div className="mt-2 flex items-center gap-2">
                <button
                  onClick={() => setInput('What internships suit my CV?')}
                  disabled={isLoading}
                  className="flex-1 rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-[11px] text-gray-300 hover:border-[#84cc16]/50 hover:text-white transition-colors disabled:opacity-50 truncate"
                >
                  What matches my CV?
                </button>
                <button
                  onClick={() => setInput('Summarize my CV and highlight my strengths')}
                  disabled={isLoading}
                  className="flex-1 rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-[11px] text-gray-300 hover:border-[#84cc16]/50 hover:text-white transition-colors disabled:opacity-50 truncate"
                >
                  Summarize my CV
                </button>
              </div>
            )}
            <p className="mt-1.5 text-[10px] text-gray-500 text-center">
              AI may make mistakes — verify important details.
            </p>
          </div>
        </div>
      )}

      {/* Voice call overlay */}
      {showCall && (
        <CallWidget
          initialHistory={messages}
          onHistoryChange={setMessages}
          onEnd={() => setShowCall(false)}
        />
      )}

      <style>{`
        @keyframes fadeInSlideUp {
          from { opacity: 0; transform: translateY(16px) scale(0.98); }
          to { opacity: 1; transform: translateY(0) scale(1); }
        }
        .fade-in-slide-up {
          animation: fadeInSlideUp 0.22s ease-out;
        }
      `}</style>
    </>
  );
}
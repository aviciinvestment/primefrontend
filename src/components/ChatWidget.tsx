import { useState, useRef, useEffect } from 'react';
import { MessageCircle, X, Send, Bot, User as UserIcon, Loader2, Phone } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import CallWidget from './CallWidget';
import MarkdownView from './MarkdownView';

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

const WELCOME_MESSAGE: ChatMessage = {
  role: 'assistant',
  content:
    "Hi! I'm PrimeOpportunity AI, your career assistant.\n\nI can help you find scholarships, internships, graduate programmes, and fellowships on our platform. Just ask me anything, e.g. *\"show me engineering internships in Lagos\"* or *\"scholarships for recent graduates\"*.",
};

export default function ChatWidget() {
  const { user } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [showCall, setShowCall] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);

  const API_URL = 'http://localhost:5000/api/ai/chat';

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

    // Build history from the last 10 messages before the new user message
    const history = updated.slice(-10).map(m => ({ role: m.role, content: m.content }));

    try {
      const res = await fetch(API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message, history, userId: user?.uid || '' }),
      });

      const data = await res.json();
      if (data.success) {
        setMessages(prev => [...prev, { role: 'assistant', content: data.reply }]);
      } else {
        setMessages(prev => [
          ...prev,
          { role: 'assistant', content: 'Sorry, I could not process that. Please try again.' },
        ]);
      }
    } catch {
      setMessages(prev => [
        ...prev,
        {
          role: 'assistant',
          content:
            'Sorry, I am having trouble connecting right now. Please check that the server is running and try again.',
        },
      ]);
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
        <div className="fixed bottom-20 right-4 sm:bottom-24 sm:right-6 z-[95] flex flex-col overflow-hidden rounded-2xl border border-white/10 bg-[#0d1410]/95 backdrop-blur-2xl shadow-2xl w-[calc(100vw-2rem)] sm:w-[400px] h-[70vh] sm:h-[560px] max-h-[75vh] fade-in-slide-up">
          
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3.5 border-b border-white/10 bg-gradient-to-br from-indigo-500 via-purple-500 to-primary">
            <div className="flex items-center gap-3">
              <div className="relative flex h-9 w-9 items-center justify-center rounded-full bg-white/15 border border-white/20">
                <Bot className="h-5 w-5 text-white" />
                <span className="absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full bg-[#84cc16] border-2 border-[#1a1f2e]"></span>
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
                <div className="rounded-2xl rounded-bl-sm bg-white/[0.06] border border-white/10 px-4 py-3 flex items-center gap-1.5">
                  <Loader2 className="h-4 w-4 text-[#84cc16] animate-spin" />
                  <span className="text-sm text-gray-300">Thinking...</span>
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
                className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[#84cc16] text-[#070e0a] hover:bg-[#84cc16]/90 active:scale-95 transition-all disabled:opacity-40 disabled:cursor-not-allowed shadow-[0_0_15px_rgba(132,204,22,0.3)]"
              >
                {isLoading ? <Loader2 className="h-5 w-5 animate-spin" /> : <Send className="h-5 w-5" />}
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
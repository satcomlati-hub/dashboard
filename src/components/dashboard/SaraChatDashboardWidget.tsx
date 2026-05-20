'use client';

import React, { useState, useRef, useEffect, ChangeEvent } from 'react';
import { useSession } from 'next-auth/react';

type Message = {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  userImage?: string | null;
  timestamp?: number;
};

function renderText(text: string) {
  const parts: React.ReactNode[] = [];
  const regex = /\*\*(.+?)\*\*/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  let key = 0;
  while ((match = regex.exec(text)) !== null) {
    if (match.index > lastIndex) parts.push(text.slice(lastIndex, match.index));
    parts.push(<strong key={key++} className="font-semibold text-neutral-900 dark:text-neutral-100">{match[1]}</strong>);
    lastIndex = match.index + match[0].length;
  }
  if (lastIndex < text.length) parts.push(text.slice(lastIndex));
  return parts;
}

const DASHBOARD_SESSION_ID = 'sara_dashboard_widget_session';
const WELCOME: Message = {
  id: 'w',
  role: 'assistant',
  content: '¡Hola! Soy **SARA**. ¿En qué te puedo ayudar hoy desde este panel?',
};

export default function SaraChatDashboardWidget() {
  const { data: session } = useSession();
  const [messages, setMessages]       = useState<Message[]>([]);
  const [input, setInput]             = useState('');
  const [loading, setLoading]         = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl]   = useState<string | null>(null);

  const endRef       = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const inputRef     = useRef<HTMLInputElement>(null);

  // Load from local storage
  useEffect(() => {
    try {
      const saved = localStorage.getItem('sara_dashboard_messages');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed && parsed.length > 0) {
          setMessages(parsed);
          return;
        }
      }
    } catch {
      // ignore
    }
    setMessages([WELCOME]);
  }, []);

  // Save to local storage whenever messages change
  useEffect(() => {
    if (messages.length > 0) {
      const persistable = messages.map(m => ({ ...m, userImage: null }));
      localStorage.setItem('sara_dashboard_messages', JSON.stringify(persistable));
    }
  }, [messages]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

  const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) { alert('Máximo 5MB.'); return; }
    setSelectedFile(file);
    const reader = new FileReader();
    reader.onloadend = () => setPreviewUrl(reader.result as string);
    reader.readAsDataURL(file);
  };

  const clearFile = () => {
    setSelectedFile(null);
    setPreviewUrl(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleSubmit = async (e: React.SyntheticEvent) => {
    e.preventDefault();
    if ((!input.trim() && !selectedFile) || loading) return;

    const userMsg: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: input,
      userImage: previewUrl,
      timestamp: Date.now(),
    };

    const withUser = [...messages, userMsg];
    setMessages(withUser);
    const currentInput = input;
    const currentFile  = selectedFile;
    setInput('');
    clearFile();
    setLoading(true);

    try {
      const formData = new FormData();
      formData.append('query', currentInput);
      formData.append('sessionId', DASHBOARD_SESSION_ID);
      if (currentFile) formData.append('image', currentFile);

      const res = await fetch('/api/chat', { method: 'POST', body: formData });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);

      if (res.body) {
        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let buffer = '';
        let accumulated = '';
        let streamMsgId: string | null = null;

        try {
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split('\n');
            buffer = lines.pop() ?? '';

            for (const line of lines) {
              const trimmed = line.trim();
              if (!trimmed) continue;

              try {
                const parsed = JSON.parse(trimmed);
                if (parsed.type !== 'item' || !parsed.content) continue;
                const chunk: string = parsed.content;

                if (!streamMsgId) {
                  streamMsgId = (Date.now() + 1).toString();
                  accumulated = chunk;
                  setLoading(false);
                  const displayContent = accumulated.replace(/Calling\s+[\w-]+\s+with\s+input:\s*\{[\s\S]*?\}\n*/g, '').trimStart();
                  setMessages([...withUser, { id: streamMsgId, role: 'assistant', content: displayContent, timestamp: Date.now() }]);
                } else {
                  accumulated += chunk;
                  const displayContent = accumulated.replace(/Calling\s+[\w-]+\s+with\s+input:\s*\{[\s\S]*?\}\n*/g, '').trimStart();
                  setMessages(prev =>
                    prev.map(m => m.id === streamMsgId ? { ...m, content: displayContent } : m)
                  );
                }
              } catch {
                // ignore
              }
            }
          }
        } finally {
          reader.releaseLock();
        }

        if (!streamMsgId) {
          setLoading(false);
          setMessages([...withUser, {
            id: (Date.now() + 1).toString(),
            role: 'assistant',
            content: 'Sin respuesta.',
            timestamp: Date.now(),
          }]);
        }
      } else {
        const data = await res.json();
        setMessages([...withUser, {
          id: (Date.now() + 1).toString(),
          role: 'assistant',
          content: data.response || 'No pude generar una respuesta.',
          timestamp: Date.now(),
        }]);
      }
    } catch (err) {
      console.error(err);
      setMessages([...withUser, {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: 'Error de conexión con la IA.',
        timestamp: Date.now(),
      }]);
      setLoading(false);
    }
  };

  const handleClearHistory = () => {
    if (confirm('¿Deseas vaciar el historial de este chat?')) {
      setMessages([WELCOME]);
      localStorage.removeItem('sara_dashboard_messages');
    }
  };

  return (
    <div className="bg-white dark:bg-[#131313] border border-neutral-200 dark:border-neutral-800 rounded-xl overflow-hidden shadow-sm flex flex-col h-[400px]">
      {/* Header */}
      <div className="px-5 py-3.5 border-b border-neutral-200 dark:border-neutral-800 flex justify-between items-center shrink-0">
        <div className="flex items-center gap-2">
          <div className="w-2.5 h-2.5 rounded-full bg-[#71BF44] animate-pulse" />
          <h2 className="text-sm font-semibold text-neutral-900 dark:text-white">Chat con SARA</h2>
        </div>
        <button
          onClick={handleClearHistory}
          className="text-neutral-400 hover:text-red-500 dark:hover:text-red-400 transition-colors p-1"
          title="Limpiar chat"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <polyline points="3 6 5 6 21 6" />
            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
          </svg>
        </button>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4 min-h-0 bg-neutral-50/50 dark:bg-neutral-950/20">
        {messages.map((m) => (
          <div key={m.id} className={`flex gap-2.5 ${m.role === 'user' ? 'flex-row-reverse' : ''}`}>
            {m.role === 'assistant' && (
              <div className="w-6 h-6 rounded-full shrink-0 mt-0.5 flex items-center justify-center font-bold text-[9px] bg-gradient-to-br from-[#71BF44] to-[#5a9c33] text-white shadow-sm">
                S
              </div>
            )}
            {m.role === 'user' && (
              <div className="w-6 h-6 rounded-full shrink-0 mt-0.5 flex items-center justify-center bg-neutral-200 dark:bg-neutral-800 text-[9px] font-bold text-neutral-500 overflow-hidden shadow-sm">
                {session?.user?.image ? (
                  <img src={session.user.image} alt="User" className="w-full h-full object-cover" />
                ) : (
                  session?.user?.name?.[0] || 'U'
                )}
              </div>
            )}
            <div
              className={`text-xs leading-relaxed px-3 py-2 max-w-[80%] ${
                m.role === 'assistant'
                  ? 'bg-white dark:bg-[#1f1f1f] border border-neutral-200 dark:border-neutral-800 text-neutral-800 dark:text-neutral-200 rounded-xl rounded-tl-none shadow-xs'
                  : 'bg-neutral-900 dark:bg-neutral-100 text-white dark:text-neutral-900 rounded-xl rounded-tr-none shadow-xs'
              }`}
            >
              <p className="whitespace-pre-wrap break-words">{m.role === 'assistant' ? renderText(m.content) : m.content}</p>
              {m.timestamp && (
                <p className={`text-[8px] mt-1 opacity-50 ${m.role === 'user' ? 'text-right' : 'text-left'}`}>
                  {new Date(m.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </p>
              )}
            </div>
          </div>
        ))}
        {loading && (
          <div className="flex gap-2.5 animate-in fade-in">
            <div className="w-6 h-6 rounded-full shrink-0 animate-pulse flex items-center justify-center font-bold text-[9px] bg-gradient-to-br from-[#71BF44] to-[#5a9c33] text-white shadow-sm">
              S
            </div>
            <div className="px-3 py-2 rounded-xl rounded-tl-none bg-white dark:bg-[#1f1f1f] border border-neutral-200 dark:border-neutral-800 shadow-xs flex gap-1 items-center">
              {[0, 120, 240].map((d) => (
                <span key={d} className="w-1.5 h-1.5 rounded-full animate-bounce bg-neutral-400 dark:bg-neutral-500" style={{ animationDelay: `${d}ms` }} />
              ))}
            </div>
          </div>
        )}
        <div ref={endRef} />
      </div>

      {/* Input Form */}
      <div className="p-3 bg-white dark:bg-[#131313] border-t border-neutral-200 dark:border-neutral-800 shrink-0">
        {previewUrl && (
          <div className="mb-2 relative inline-block">
            <div className="relative w-12 h-12 rounded-lg overflow-hidden border border-[#71BF44]">
              <img src={previewUrl} alt="adjunto" className="w-full h-full object-cover" />
              <button
                type="button"
                onClick={clearFile}
                className="absolute top-0.5 right-0.5 rounded-full p-0.5 bg-red-500 text-white"
              >
                <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="4">
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </div>
          </div>
        )}

        <form onSubmit={handleSubmit} className="flex items-center gap-1.5 bg-neutral-100 dark:bg-neutral-900 rounded-lg px-2 py-1 border border-neutral-200 dark:border-neutral-800">
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="p-1 text-neutral-400 hover:text-[#71BF44] transition-colors"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <path d="m21.44 11.05-9.19 9.19a6 6 0 0 1-8.49-8.49l8.57-8.57A4 4 0 1 1 18 8.84l-8.59 8.51a2 2 0 0 1-2.83-2.83l8.49-8.48" />
            </svg>
          </button>
          <input type="file" ref={fileInputRef} onChange={handleFileChange} accept="image/*" className="hidden" />

          <input
            ref={inputRef}
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Pregúntale a SARA..."
            className="flex-1 bg-transparent border-none outline-none text-xs py-1.5 text-neutral-900 dark:text-white placeholder-neutral-400"
          />

          <button
            type="submit"
            disabled={(!input.trim() && !selectedFile) || loading}
            className="p-1.5 rounded-md bg-[#71BF44] text-white hover:bg-[#5a9c33] disabled:opacity-40 disabled:cursor-not-allowed transition-all"
          >
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
              <line x1="22" y1="2" x2="11" y2="13" />
              <polygon points="22 2 15 22 11 13 2 9 22 2" />
            </svg>
          </button>
        </form>
      </div>
    </div>
  );
}

'use client';

import React, { useState, useRef, useEffect, ChangeEvent } from 'react';
import Link from 'next/link';

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

const WIDGET_SESSION_ID = 'sara_widget_session';

const WELCOME: Message = {
  id: 'w',
  role: 'assistant',
  content: '¡Hola! Soy **SARA**. ¿En qué te puedo ayudar?',
};

export default function SaraChatWidget() {
  const [open, setOpen]               = useState(false);
  const [messages, setMessages]       = useState<Message[]>([]);
  const [input, setInput]             = useState('');
  const [loading, setLoading]         = useState(false);
  const [unread, setUnread]           = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl]   = useState<string | null>(null);

  const endRef       = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const inputRef     = useRef<HTMLInputElement>(null);

  // Load from local storage
  useEffect(() => {
    try {
      const saved = localStorage.getItem('sara_widget_messages');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed && parsed.length > 0) {
          setMessages(parsed);
        }
      }
    } catch {
      // ignore
    }
  }, []);

  // Save to local storage whenever messages change
  useEffect(() => {
    if (messages.length > 0) {
      // Evitar guardar imágenes base64 para que no colapse el storage
      const persistable = messages.map(m => ({ ...m, userImage: null }));
      localStorage.setItem('sara_widget_messages', JSON.stringify(persistable));
    }
  }, [messages]);

  useEffect(() => {
    if (open) {
      setUnread(false);
      setTimeout(() => inputRef.current?.focus(), 150);
    }
  }, [open]);

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
      formData.append('sessionId', WIDGET_SESSION_ID);
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
                // ignorar
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

        if (!open) setUnread(true);

      } else {
        const data = await res.json();
        setMessages([...withUser, {
          id: (Date.now() + 1).toString(),
          role: 'assistant',
          content: data.response || 'No pude generar una respuesta.',
          timestamp: Date.now(),
        }]);
        if (!open) setUnread(true);
      }

    } catch {
      setMessages([...withUser, {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: 'Error al conectar con SARA. Verifica que n8n esté activo.',
        timestamp: Date.now(),
      }]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      {/* Expanded panel */}
      {open && (
        <div
          className="fixed bottom-24 right-6 z-50 flex flex-col overflow-hidden w-[350px] md:w-[380px] h-[520px] rounded-2xl border bg-white/80 dark:bg-neutral-900/80 backdrop-blur-xl border-neutral-200/50 dark:border-neutral-800/50 shadow-2xl animate-in slide-in-from-bottom-4 fade-in duration-300"
        >
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 shrink-0 bg-white/50 dark:bg-neutral-900/50 border-b border-neutral-200/50 dark:border-neutral-800/50">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-full flex items-center justify-center shrink-0 font-bold text-sm bg-gradient-to-br from-[#71BF44] to-[#5a9c33] text-white shadow-sm shadow-[#71BF44]/20">
                S
              </div>
              <div>
                <p className="text-sm font-bold leading-none text-neutral-900 dark:text-white">SARA</p>
                <div className="flex items-center gap-1 mt-1">
                  <span className="w-1.5 h-1.5 rounded-full animate-pulse bg-[#71BF44]" />
                  <span className="text-[10px] text-[#71BF44] font-medium tracking-wide">EN LÍNEA</span>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-1">
              <Link
                href="/chat"
                title="Abrir chat completo"
                className="p-1.5 rounded-md hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors text-neutral-500"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="15 3 21 3 21 9"/><polyline points="9 21 3 21 3 15"/><line x1="21" y1="3" x2="14" y2="10"/><line x1="3" y1="21" x2="10" y2="14"/>
                </svg>
              </Link>
              <button
                onClick={() => setOpen(false)}
                className="p-1.5 rounded-md hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors text-neutral-500"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="5" y1="12" x2="19" y2="12"/>
                </svg>
              </button>
            </div>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
            {messages.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-center p-4 space-y-4 animate-in fade-in duration-500">
                <div className="w-14 h-14 rounded-2xl bg-[#71BF44]/10 dark:bg-[#71BF44]/20 border border-[#71BF44]/20 flex items-center justify-center text-[#71BF44] text-2xl font-bold shadow-inner">
                  S
                </div>
                <div className="space-y-1">
                  <p className="text-sm font-bold text-neutral-800 dark:text-neutral-200">¿En qué puedo ayudarte?</p>
                  <p className="text-xs text-neutral-500">Estoy lista para analizar información.</p>
                </div>
              </div>
            ) : (
              messages.map((m) => (
                <div key={m.id} className={`flex gap-2.5 animate-in slide-in-from-bottom-2 fade-in ${m.role === 'user' ? 'flex-row-reverse' : ''}`}>
                  {m.role === 'assistant' && (
                    <div className="w-6 h-6 rounded-full shrink-0 mt-0.5 flex items-center justify-center font-bold text-[10px] bg-gradient-to-br from-[#71BF44] to-[#5a9c33] text-white shadow-sm">
                      S
                    </div>
                  )}
                  <div
                    className={`text-sm leading-relaxed px-3.5 py-2.5 max-w-[85%] ${
                      m.role === 'assistant'
                        ? 'bg-white dark:bg-[#1f1f1f] border border-neutral-200 dark:border-neutral-800 text-neutral-800 dark:text-neutral-200 rounded-2xl rounded-tl-sm shadow-sm'
                        : 'bg-neutral-900 dark:bg-neutral-100 text-white dark:text-neutral-900 rounded-2xl rounded-tr-sm shadow-sm'
                    }`}
                  >
                    {m.userImage && (
                      <img src={m.userImage} alt="adjunto" className="rounded-lg max-h-32 object-contain mb-2 border border-neutral-200/20" />
                    )}
                    <p className="whitespace-pre-wrap break-words text-[13px]">{m.role === 'assistant' ? renderText(m.content) : m.content}</p>
                    {m.timestamp && (
                      <p className={`text-[9px] mt-1 opacity-50 ${m.role === 'user' ? 'text-right' : 'text-left'}`}>
                        {new Date(m.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </p>
                    )}
                  </div>
                </div>
              ))
            )}

            {loading && (
              <div className="flex gap-2.5 animate-in fade-in">
                <div className="w-6 h-6 rounded-full shrink-0 animate-pulse flex items-center justify-center font-bold text-[10px] bg-gradient-to-br from-[#71BF44] to-[#5a9c33] text-white shadow-sm">
                  S
                </div>
                <div className="px-4 py-3 rounded-2xl rounded-tl-sm bg-white dark:bg-[#1f1f1f] border border-neutral-200 dark:border-neutral-800 shadow-sm flex gap-1 items-center">
                  {[0, 120, 240].map((d) => (
                    <span key={d} className="w-1.5 h-1.5 rounded-full animate-bounce bg-neutral-400 dark:bg-neutral-500" style={{ animationDelay: `${d}ms` }} />
                  ))}
                </div>
              </div>
            )}
            <div ref={endRef} />
          </div>

          {/* Input */}
          <div className="px-4 pb-4 pt-2 shrink-0 bg-white/50 dark:bg-neutral-900/50 border-t border-neutral-200/50 dark:border-neutral-800/50">
            {previewUrl && (
              <div className="mb-2 relative inline-block animate-in zoom-in-95">
                <div className="relative w-14 h-14 rounded-lg overflow-hidden border-2 border-[#71BF44] shadow-sm">
                  <img src={previewUrl} alt="prev" className="w-full h-full object-cover" />
                  <button onClick={clearFile} className="absolute top-0.5 right-0.5 rounded-full p-0.5 bg-red-500/80 backdrop-blur-sm text-white hover:bg-red-600 transition-colors">
                    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                      <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                    </svg>
                  </button>
                </div>
              </div>
            )}

            <form onSubmit={handleSubmit} className="flex items-center gap-2 bg-neutral-100 dark:bg-neutral-800/50 rounded-xl px-2 py-1.5 border border-neutral-200 dark:border-neutral-800 focus-within:ring-2 focus-within:ring-[#71BF44]/30 focus-within:border-[#71BF44] transition-all">
              <button type="button" onClick={() => fileInputRef.current?.click()} className="p-2 shrink-0 transition-colors text-neutral-400 hover:text-[#71BF44]">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="m21.44 11.05-9.19 9.19a6 6 0 0 1-8.49-8.49l8.57-8.57A4 4 0 1 1 18 8.84l-8.59 8.51a2 2 0 0 1-2.83-2.83l8.49-8.48"/>
                </svg>
              </button>
              <input type="file" ref={fileInputRef} onChange={handleFileChange} accept="image/*" className="hidden" />

              <input
                ref={inputRef}
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Escribe tu consulta..."
                className="flex-1 bg-transparent border-none outline-none text-sm py-2 px-1 text-neutral-900 dark:text-white placeholder-neutral-400"
              />

              <button
                type="submit"
                disabled={(!input.trim() && !selectedFile) || loading}
                className="w-8 h-8 flex items-center justify-center rounded-lg transition-all disabled:opacity-40 disabled:cursor-not-allowed bg-[#71BF44] text-white hover:bg-[#5a9c33] shadow-sm active:scale-95"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="ml-0.5">
                  <line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/>
                </svg>
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Float button */}
      <button
        onClick={() => setOpen((v) => !v)}
        className="fixed bottom-6 right-6 z-50 w-14 h-14 flex items-center justify-center rounded-2xl transition-all hover:scale-105 active:scale-95 shadow-lg group"
        style={{
          background: open ? 'var(--bg-float, #fff)' : 'linear-gradient(135deg, #71BF44, #5a9c33)',
          boxShadow: open ? '0 4px 16px rgba(0,0,0,0.1)' : '0 8px 24px rgba(113,191,68,0.4)',
          border: open ? '1px solid rgba(128,128,128,0.2)' : 'none',
        }}
        title={open ? 'Cerrar SARA' : 'Consultar a SARA'}
      >
        <div className="absolute inset-0 bg-black/5 dark:bg-white/5 opacity-0 group-hover:opacity-100 transition-opacity rounded-2xl" />
        
        {open ? (
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="text-neutral-500 dark:text-neutral-400">
            <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
          </svg>
        ) : (
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
          </svg>
        )}

        {unread && !open && (
          <span
            className="absolute -top-1 -right-1 w-3.5 h-3.5 rounded-full border-2 border-white dark:border-neutral-900 bg-red-500 animate-pulse"
          />
        )}
      </button>
    </>
  );
}

'use client';

import React, { useState, useRef, useEffect, ChangeEvent } from 'react';
import Link from 'next/link';

type Message = {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  userImage?: string | null;
};

function renderText(text: string) {
  // Bold only — keep it lightweight for the widget
  const parts: React.ReactNode[] = [];
  const regex = /\*\*(.+?)\*\*/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  let key = 0;
  while ((match = regex.exec(text)) !== null) {
    if (match.index > lastIndex) parts.push(text.slice(lastIndex, match.index));
    parts.push(<strong key={key++} className="font-semibold" style={{ color: '#e5e5e5' }}>{match[1]}</strong>);
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
  const [messages, setMessages]       = useState<Message[]>([WELCOME]);
  const [input, setInput]             = useState('');
  const [loading, setLoading]         = useState(false);
  const [unread, setUnread]           = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl]   = useState<string | null>(null);

  const endRef       = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const inputRef     = useRef<HTMLInputElement>(null);

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

      const contentType = res.headers.get('content-type') || '';

      if (res.body && contentType.includes('event-stream')) {
        // ── Streaming (SSE) ────────────────────────────────────────────────
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
              if (!line.startsWith('data: ')) continue;
              const raw = line.slice(6).trim();
              if (!raw || raw === '[DONE]') continue;

              let chunk = '';
              try {
                const parsed = JSON.parse(raw);
                if (parsed.type === 'done') continue;
                chunk = parsed.text ?? parsed.content ?? parsed.output ?? '';
              } catch {
                chunk = raw;
              }

              if (!chunk) continue;

              if (!streamMsgId) {
                streamMsgId = (Date.now() + 1).toString();
                accumulated = chunk;
                setLoading(false);
                setMessages([...withUser, { id: streamMsgId, role: 'assistant', content: chunk }]);
              } else {
                accumulated += chunk;
                setMessages(prev =>
                  prev.map(m => m.id === streamMsgId ? { ...m, content: accumulated } : m)
                );
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
          }]);
        }

        if (!open) setUnread(true);

      } else {
        // ── JSON (fallback) ──────────────────────────────────────────────
        const data = await res.json();
        setMessages([...withUser, {
          id: (Date.now() + 1).toString(),
          role: 'assistant',
          content: data.response || 'No pude generar una respuesta.',
        }]);
        if (!open) setUnread(true);
      }

    } catch {
      setMessages([...withUser, {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: 'Error al conectar con SARA. Verifica que n8n esté activo.',
      }]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      {/* ── Expanded panel ─────────────────────────────────────────────────── */}
      {open && (
        <div
          className="fixed bottom-24 left-6 z-50 flex flex-col overflow-hidden"
          style={{
            width: '380px',
            height: '520px',
            background: '#191919',
            borderRadius: '0.5rem',
            boxShadow: '0 24px 48px rgba(0,0,0,0.6)',
            border: '1px solid rgba(72,72,72,0.15)',
          }}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 shrink-0" style={{ background: '#1f1f1f', borderBottom: '1px solid rgba(72,72,72,0.1)' }}>
            <div className="flex items-center gap-2.5">
              <div className="w-7 h-7 rounded flex items-center justify-center shrink-0 font-bold text-sm" style={{ background: '#1a4500', color: '#71BF44' }}>
                S
              </div>
              <div>
                <p className="text-sm font-bold leading-none" style={{ color: '#e5e5e5' }}>SARA</p>
                <div className="flex items-center gap-1 mt-0.5">
                  <span className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ background: '#71BF44' }} />
                  <span className="text-[10px]" style={{ color: '#71BF44' }}>en línea</span>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-1">
              <Link
                href="/chat"
                title="Abrir chat completo"
                className="p-1.5 rounded hover:bg-white/5 transition-colors"
                style={{ color: '#ababab' }}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="15 3 21 3 21 9"/><polyline points="9 21 3 21 3 15"/><line x1="21" y1="3" x2="14" y2="10"/><line x1="3" y1="21" x2="10" y2="14"/>
                </svg>
              </Link>
              <button
                onClick={() => setOpen(false)}
                className="p-1.5 rounded hover:bg-white/5 transition-colors"
                style={{ color: '#ababab' }}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="5" y1="12" x2="19" y2="12"/>
                </svg>
              </button>
            </div>
          </div>

          {/* Messages */}
          <div
            className="flex-1 overflow-y-auto px-4 py-4 space-y-4"
            style={{ scrollbarWidth: 'thin', scrollbarColor: '#262626 transparent' }}
          >
            {messages.map((m) => (
              <div key={m.id} className={`flex gap-2.5 ${m.role === 'user' ? 'flex-row-reverse' : ''}`}>
                {m.role === 'assistant' && (
                  <div className="w-6 h-6 rounded-sm shrink-0 mt-0.5 flex items-center justify-center font-bold text-[10px]" style={{ background: '#1a4500', color: '#71BF44' }}>
                    S
                  </div>
                )}
                <div
                  className="text-xs leading-relaxed rounded-lg px-3 py-2.5 max-w-[80%]"
                  style={
                    m.role === 'assistant'
                      ? { background: '#262626', color: 'rgba(229,229,229,0.9)' }
                      : { background: '#1a4500', color: '#e5e5e5', borderRadius: '0.5rem 0.5rem 0.125rem 0.5rem' }
                  }
                >
                  {m.userImage && (
                    <img src={m.userImage} alt="adjunto" className="rounded max-h-32 object-contain mb-2" />
                  )}
                  <p className="whitespace-pre-wrap">{m.role === 'assistant' ? renderText(m.content) : m.content}</p>
                </div>
              </div>
            ))}

            {loading && (
              <div className="flex gap-2.5">
                <div className="w-6 h-6 rounded-sm shrink-0 animate-pulse flex items-center justify-center font-bold text-[10px]" style={{ background: '#1a4500', color: '#71BF44' }}>
                  S
                </div>
                <div className="px-3 py-3 rounded-lg flex gap-1 items-center" style={{ background: '#262626' }}>
                  {[0, 120, 240].map((d) => (
                    <span key={d} className="w-1.5 h-1.5 rounded-full animate-bounce" style={{ background: '#ababab', animationDelay: `${d}ms` }} />
                  ))}
                </div>
              </div>
            )}
            <div ref={endRef} />
          </div>

          {/* Input */}
          <div className="px-3 pb-3 pt-2 shrink-0" style={{ background: '#131313', borderTop: '1px solid rgba(72,72,72,0.08)' }}>
            {/* Image preview */}
            {previewUrl && (
              <div className="mb-2 relative inline-block">
                <div className="relative w-14 h-14 rounded overflow-hidden" style={{ border: '1.5px solid #71BF44' }}>
                  <img src={previewUrl} alt="prev" className="w-full h-full object-cover" />
                  <button onClick={clearFile} className="absolute top-0.5 right-0.5 rounded-full p-0.5" style={{ background: '#7e2b17', color: '#ff9b82' }}>
                    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                      <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                    </svg>
                  </button>
                </div>
              </div>
            )}

            <form onSubmit={handleSubmit} className="flex items-center gap-2">
              {/* Attach */}
              <button type="button" onClick={() => fileInputRef.current?.click()} className="p-1.5 shrink-0 transition-colors" style={{ color: '#ababab' }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="m21.44 11.05-9.19 9.19a6 6 0 0 1-8.49-8.49l8.57-8.57A4 4 0 1 1 18 8.84l-8.59 8.51a2 2 0 0 1-2.83-2.83l8.49-8.48"/>
                </svg>
              </button>
              <input type="file" ref={fileInputRef} onChange={handleFileChange} accept="image/*" className="hidden" />

              {/* Text input */}
              <input
                ref={inputRef}
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Escribe aquí..."
                className="flex-1 bg-transparent border-none outline-none text-xs py-2 px-3 rounded"
                style={{
                  background: '#000000',
                  color: '#e5e5e5',
                  borderBottom: '1.5px solid rgba(72,72,72,0.3)',
                }}
                onFocus={(e) => (e.currentTarget.style.borderBottomColor = '#71BF44')}
                onBlur={(e) => (e.currentTarget.style.borderBottomColor = 'rgba(72,72,72,0.3)')}
              />

              {/* Send */}
              <button
                type="submit"
                disabled={(!input.trim() && !selectedFile) || loading}
                className="w-8 h-8 flex items-center justify-center rounded transition-all disabled:opacity-30 disabled:cursor-not-allowed hover:scale-105 active:scale-95"
                style={{ background: 'linear-gradient(135deg, #63b037, #1a4500)', color: 'white', boxShadow: '0 2px 8px rgba(113,191,68,0.25)' }}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/>
                </svg>
              </button>
            </form>
          </div>
        </div>
      )}

      {/* ── Float button ────────────────────────────────────────────────────── */}
      <button
        onClick={() => setOpen((v) => !v)}
        className="fixed bottom-6 left-6 z-50 w-14 h-14 flex items-center justify-center rounded-lg transition-all hover:scale-105 active:scale-95"
        style={{
          background: open ? '#131313' : 'linear-gradient(135deg, #63b037, #1a4500)',
          boxShadow: open ? '0 4px 16px rgba(0,0,0,0.4)' : '0 8px 24px rgba(113,191,68,0.3)',
          border: open ? '1px solid rgba(72,72,72,0.2)' : 'none',
        }}
        title={open ? 'Cerrar SARA' : 'Consultar a SARA'}
      >
        {open ? (
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={open ? '#ababab' : 'white'} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
          </svg>
        ) : (
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
          </svg>
        )}

        {/* Unread dot */}
        {unread && !open && (
          <span
            className="absolute top-1.5 right-1.5 w-2.5 h-2.5 rounded-full"
            style={{ background: '#71BF44', boxShadow: '0 0 6px rgba(113,191,68,0.8)' }}
          />
        )}
      </button>
    </>
  );
}

'use client';

import React, { useState, useRef, useEffect, ChangeEvent } from 'react';
import { useSession } from 'next-auth/react';

// ─── Types ────────────────────────────────────────────────────────────────────

type ImageAttachment = {
  url?: string | null;
  base64?: string | null;
  filename?: string;
  sourceUrl?: string;
};

type Source = { url: string; title?: string };

type Message = {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  images?: ImageAttachment[];
  sources?: Source[];
  userImage?: string | null;
};

type StoredSession = {
  id: string;
  title: string;
  preview: string;
  timestamp: number;
  messages: Message[];
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function renderMarkdown(text: string) {
  const parts: React.ReactNode[] = [];
  const regex = /(\*\*(.+?)\*\*)|(\[([^\]]+)\]\(([^)]+)\))/g;
  let lastIndex = 0, key = 0;
  let match: RegExpExecArray | null;
  while ((match = regex.exec(text)) !== null) {
    if (match.index > lastIndex) parts.push(text.slice(lastIndex, match.index));
    if (match[1]) parts.push(<strong key={key++} className="font-bold">{match[2]}</strong>);
    else if (match[3]) parts.push(
      <a key={key++} href={match[5]} target="_blank" rel="noopener noreferrer"
        className="text-[#71BF44] underline underline-offset-2 hover:text-[#98e968] transition-colors">
        {match[4]}
      </a>
    );
    lastIndex = match.index + match[0].length;
  }
  if (lastIndex < text.length) parts.push(text.slice(lastIndex));
  return parts;
}

function newId() { return `${Date.now()}_${Math.random().toString(36).slice(2, 6)}`; }

function formatTime(ts: number) {
  const d = Date.now() - ts;
  if (d < 60_000) return 'ahora';
  if (d < 3_600_000) return `${Math.floor(d / 60_000)}m`;
  if (d < 86_400_000) return `${Math.floor(d / 3_600_000)}h`;
  return new Date(ts).toLocaleDateString('es-MX', { day: 'numeric', month: 'short' });
}

const WELCOME: Message = {
  id: 'welcome',
  role: 'assistant',
  content: '¡Hola! Soy **SARA**, tu asistente de inteligencia artificial de SATCOM. Tengo acceso a los manuales técnicos y puedo analizar imágenes. ¿En qué puedo ayudarte hoy?',
};

// ─── SVG Icons ────────────────────────────────────────────────────────────────

const IconSend = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <line x1="22" y1="2" x2="11" y2="13" /><polygon points="22 2 15 22 11 13 2 9 22 2" />
  </svg>
);
const IconAttach = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="m21.44 11.05-9.19 9.19a6 6 0 0 1-8.49-8.49l8.57-8.57A4 4 0 1 1 18 8.84l-8.59 8.51a2 2 0 0 1-2.83-2.83l8.49-8.48" />
  </svg>
);
const IconClose = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
    <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
  </svg>
);
const IconPlus = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
  </svg>
);
const IconSara = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="4" /><path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41" />
  </svg>
);
const IconExternalLink = () => (
  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" /><polyline points="15 3 21 3 21 9" /><line x1="10" y1="14" x2="21" y2="3" />
  </svg>
);

const IconTrash = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="3 6 5 6 21 6" /><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" /><line x1="10" y1="11" x2="10" y2="17" /><line x1="14" y1="11" x2="14" y2="17" />
  </svg>
);

// ─── Component ────────────────────────────────────────────────────────────────

export default function SaraChatPage() {
  const { data: session }             = useSession();
  const [sessions, setSessions]             = useState<StoredSession[]>([]);
  const [activeSessionId, setActiveId]      = useState('');
  const [messages, setMessages]             = useState<Message[]>([WELCOME]);
  const [input, setInput]                   = useState('');
  const [isLoading, setIsLoading]           = useState(false);
  const [selectedFile, setSelectedFile]     = useState<File | null>(null);
  const [previewUrl, setPreviewUrl]         = useState<string | null>(null);

  const endRef      = useRef<HTMLDivElement>(null);
  const fileRef     = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Load sessions
  useEffect(() => {
    try {
      const raw = localStorage.getItem('sara_sessions');
      if (raw) {
        const parsed: StoredSession[] = JSON.parse(raw);
        if (parsed.length > 0) {
          setSessions(parsed);
          setActiveId(parsed[0].id);
          setMessages(parsed[0].messages);
          return;
        }
      }
    } catch { /* ignore */ }
    createSession(true);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function createSession(initial = false) {
    const id = `sara_${newId()}`;
    const s: StoredSession = { id, title: 'Nueva sesión', preview: 'Inicia una consulta', timestamp: Date.now(), messages: [WELCOME] };
    setSessions(prev => {
      const next = [s, ...prev];
      if (!initial) localStorage.setItem('sara_sessions', JSON.stringify(next));
      return next;
    });
    setActiveId(id);
    setMessages([WELCOME]);
    setInput('');
    clearFile();
  }

  function switchSession(s: StoredSession) {
    setActiveId(s.id);
    setMessages(s.messages);
    setInput('');
    clearFile();
  }

  async function deleteSession(sessionId: string) {
    if (!window.confirm('¿Estás seguro de que deseas borrar este chat? Esta acción no se puede deshacer.')) return;

    // 1. Borrar de la base de datos (Supabase)
    try {
      await fetch('/api/chat/delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId }),
      });
    } catch (err) {
      console.error('Error deleting from DB:', err);
    }

    // 2. Borrar del estado y localStorage
    setSessions(prev => {
      const next = prev.filter(s => s.id !== sessionId);
      localStorage.setItem('sara_sessions', JSON.stringify(next));

      // Si borramos la activa, cambiamos a otra o creamos una nueva
      if (sessionId === activeSessionId) {
        if (next.length > 0) {
          switchSession(next[0]);
        } else {
          createSession(false);
        }
      }
      return next;
    });
  }

  function persist(updated: Message[], sid: string) {
    setSessions(prev => {
      const firstUser = updated.find(m => m.role === 'user');
      const next = prev.map(s => s.id !== sid ? s : {
        ...s,
        title:     firstUser ? firstUser.content.slice(0, 40) || 'Sesión' : s.title,
        preview:   updated[updated.length - 1]?.content?.slice(0, 60) ?? '',
        timestamp: Date.now(),
        messages:  updated,
      });
      localStorage.setItem('sara_sessions', JSON.stringify(next));
      return next;
    });
  }

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages, isLoading]);

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 160)}px`;
    }
  }, [input]);

  function clearFile() {
    setSelectedFile(null);
    setPreviewUrl(null);
    if (fileRef.current) fileRef.current.value = '';
  }

  const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 10 * 1024 * 1024) { alert('Máximo 10MB.'); return; }
    setSelectedFile(file);
    const r = new FileReader();
    r.onloadend = () => setPreviewUrl(r.result as string);
    r.readAsDataURL(file);
  };

  const handleSubmit = async (e: React.SyntheticEvent) => {
    e.preventDefault();
    if ((!input.trim() && !selectedFile) || isLoading) return;

    const userMsg: Message = { id: newId(), role: 'user', content: input, userImage: previewUrl };
    const withUser = [...messages, userMsg];
    setMessages(withUser);
    const q = input, f = selectedFile;
    setInput('');
    clearFile();
    setIsLoading(true);

    try {
      const fd = new FormData();
      fd.append('query', q);
      fd.append('sessionId', activeSessionId);
      if (session?.user?.name) fd.append('userName', session.user.name);
      if (session?.user?.email) fd.append('userEmail', session.user.email);
      if (f) fd.append('image', f);
      const res = await fetch('/api/chat', { method: 'POST', body: fd });
      if (!res.ok) throw new Error();
      const data = await res.json();
      const saraMsg: Message = {
        id: newId(), role: 'assistant',
        content: data.response || 'Sin respuesta.',
        images:  data.images  || [],
        sources: data.sources || [],
      };
      const final = [...withUser, saraMsg];
      setMessages(final);
      persist(final, activeSessionId);
    } catch {
      const err: Message = { id: newId(), role: 'assistant', content: 'Error al conectar con SARA. Verifica que n8n esté activo.' };
      const final = [...withUser, err];
      setMessages(final);
      persist(final, activeSessionId);
    } finally {
      setIsLoading(false);
    }
  };

  const activeSession = sessions.find(s => s.id === activeSessionId);

  // ─── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="flex h-[calc(100vh-64px)] lg:h-screen bg-neutral-50 dark:bg-[#0e0e0e]">

      {/* ── History sidebar ──────────────────────────────────────────────────── */}
      <aside className="w-64 shrink-0 flex flex-col bg-white dark:bg-[#0a0a0a] border-r border-neutral-200 dark:border-neutral-800">
        {/* Header */}
        <div className="px-4 py-3 flex items-center justify-between border-b border-neutral-100 dark:border-neutral-800/60">
          <span className="text-[10px] font-bold uppercase tracking-widest text-neutral-400 dark:text-neutral-500">Historial</span>
          <button
            onClick={() => createSession()}
            className="p-1 rounded hover:bg-neutral-100 dark:hover:bg-neutral-800 text-neutral-400 hover:text-[#71BF44] transition-colors"
            title="Nueva sesión"
          >
            <IconPlus />
          </button>
        </div>

        {/* Session list */}
        <div className="flex-1 overflow-y-auto py-2">
          {sessions.length === 0 && (
            <p className="px-4 py-3 text-xs text-neutral-400 dark:text-neutral-500">Sin sesiones previas</p>
          )}
          {sessions.map((s) => {
            const active = s.id === activeSessionId;
            return (
              <div key={s.id} className="group relative">
                <button
                  onClick={() => switchSession(s)}
                  className={`w-full text-left px-4 py-3 transition-colors border-l-2 ${
                    active
                      ? 'bg-[#71BF44]/5 border-l-[#71BF44]'
                      : 'border-l-transparent hover:bg-neutral-50 dark:hover:bg-neutral-800/40'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2 mb-0.5">
                    <span className={`text-xs truncate max-w-[120px] ${active ? 'font-semibold text-neutral-900 dark:text-white' : 'font-medium text-neutral-700 dark:text-neutral-300'}`}>
                      {s.title}
                    </span>
                    <span className="text-[9px] text-neutral-400 shrink-0">{formatTime(s.timestamp)}</span>
                  </div>
                  <p className="text-[10px] text-neutral-400 dark:text-neutral-500 truncate pr-6">{s.preview}</p>
                </button>
                <button
                  onClick={(e) => { e.stopPropagation(); deleteSession(s.id); }}
                  className="absolute right-2 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 p-1.5 text-neutral-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-md transition-all"
                  title="Borrar chat"
                >
                  <IconTrash />
                </button>
              </div>
            );
          })}
        </div>
      </aside>

      {/* ── Main chat ────────────────────────────────────────────────────────── */}
      <div className="flex-1 flex flex-col min-w-0">

        {/* Chat header */}
        <div className="shrink-0 px-6 py-4 border-b border-neutral-200 dark:border-neutral-800 bg-white dark:bg-[#0e0e0e] flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-[#71BF44] to-[#5a9c33] flex items-center justify-center text-white shadow-sm shadow-[#71BF44]/20">
              <IconSara />
            </div>
            <div>
              <h2 className="text-sm font-bold text-neutral-900 dark:text-white">AI Assistant: SARA</h2>
              <div className="flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-[#71BF44] animate-pulse" />
                <span className="text-[10px] font-medium text-[#71BF44] uppercase tracking-wide">Sistema óptimo · Powered by Gemini</span>
              </div>
            </div>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => createSession()}
              className="px-3 py-1.5 text-[10px] font-bold rounded border border-neutral-200 dark:border-neutral-700 text-neutral-500 dark:text-neutral-400 hover:bg-neutral-50 dark:hover:bg-neutral-800 transition-colors uppercase tracking-wider"
            >
              Nueva sesión
            </button>
            <button
              onClick={() => setMessages([WELCOME])}
              className="px-3 py-1.5 text-[10px] font-bold rounded border border-neutral-200 dark:border-neutral-700 text-neutral-500 dark:text-neutral-400 hover:bg-neutral-50 dark:hover:bg-neutral-800 transition-colors uppercase tracking-wider"
            >
              Limpiar
            </button>
          </div>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto px-6 py-8 space-y-6">
          {messages.map((m) => (
            <div key={m.id} className={`flex gap-3 ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              {m.role === 'assistant' && (
                <div className="w-7 h-7 rounded-full bg-gradient-to-br from-[#71BF44] to-[#5a9c33] flex items-center justify-center text-white shrink-0 mt-0.5 shadow-sm">
                  <span className="font-bold text-[10px]">S</span>
                </div>
              )}

              <div className={`max-w-[80%] flex flex-col gap-2 ${m.role === 'user' ? 'items-end' : 'items-start'}`}>
                {/* Bubble */}
                <div className={`px-4 py-3 rounded-2xl text-sm leading-relaxed ${
                  m.role === 'user'
                    ? 'bg-neutral-900 dark:bg-neutral-700 text-white rounded-tr-sm'
                    : 'bg-white dark:bg-[#1a1a1a] border border-neutral-200 dark:border-neutral-800 text-neutral-800 dark:text-neutral-200 rounded-tl-sm shadow-sm'
                }`}>
                  {m.userImage && (
                    <img src={m.userImage} alt="adjunto" className="rounded-lg max-h-48 object-contain mb-2" />
                  )}
                  {m.content && (
                    <p className="whitespace-pre-wrap">{renderMarkdown(m.content)}</p>
                  )}
                </div>

                {/* RAG images */}
                {m.images && m.images.length > 0 && (
                  <div className={`flex flex-wrap gap-2 ${m.images.length > 1 ? 'grid grid-cols-2' : ''}`}>
                    {m.images.map((img, i) => {
                      const src = img.url || (img.base64 ? `data:image/jpeg;base64,${img.base64}` : null);
                      if (!src) return null;
                      return (
                        <a key={i} href={img.sourceUrl || src} target="_blank" rel="noopener noreferrer">
                          <img src={src} alt={img.filename || `Ref. ${i + 1}`}
                            className="rounded-xl max-h-48 object-contain border border-neutral-200 dark:border-neutral-800 hover:ring-2 hover:ring-[#71BF44]/40 transition-all" />
                        </a>
                      );
                    })}
                  </div>
                )}

                {/* Sources */}
                {m.sources && m.sources.length > 0 && (
                  <div className="flex flex-wrap gap-2">
                    {m.sources.map((src, i) => (
                      <a key={i} href={src.url} target="_blank" rel="noopener noreferrer"
                        className="inline-flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-full bg-[#71BF44]/10 text-[#71BF44] hover:bg-[#71BF44]/20 transition-colors">
                        <IconExternalLink />
                        {src.title || 'Ver manual'}
                      </a>
                    ))}
                  </div>
                )}
              </div>

              {m.role === 'user' && (
                <div className="w-7 h-7 rounded-full bg-neutral-200 dark:bg-neutral-700 flex items-center justify-center shrink-0 mt-0.5">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-neutral-500 dark:text-neutral-400">
                    <path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" />
                  </svg>
                </div>
              )}
            </div>
          ))}

          {/* Loading indicator */}
          {isLoading && (
            <div className="flex gap-3 justify-start">
              <div className="w-7 h-7 rounded-full bg-gradient-to-br from-[#71BF44] to-[#5a9c33] flex items-center justify-center text-white shrink-0 mt-0.5 animate-pulse shadow-sm">
                <span className="font-bold text-[10px]">S</span>
              </div>
              <div className="px-4 py-3 rounded-2xl rounded-tl-sm bg-white dark:bg-[#1a1a1a] border border-neutral-200 dark:border-neutral-800 shadow-sm flex gap-1.5 items-center">
                {[0, 150, 300].map(d => (
                  <span key={d} className="w-2 h-2 rounded-full bg-neutral-300 dark:bg-neutral-600 animate-bounce" style={{ animationDelay: `${d}ms` }} />
                ))}
              </div>
            </div>
          )}

          <div ref={endRef} />
        </div>

        {/* ── Input area ──────────────────────────────────────────────────────── */}
        <div className="shrink-0 border-t border-neutral-200 dark:border-neutral-800 bg-white dark:bg-[#0e0e0e] p-4">

          {/* Quick prompts */}
          <div className="flex flex-wrap gap-2 mb-3">
            {['Analizar telemetría satelital', 'Optimizar workflow activo', 'Estado del sistema'].map((p) => (
              <button key={p} onClick={() => setInput(p)}
                className="px-3 py-1 text-[11px] rounded-full bg-neutral-100 dark:bg-neutral-800 text-neutral-500 dark:text-neutral-400 hover:text-[#71BF44] hover:bg-[#71BF44]/10 transition-colors border border-neutral-200 dark:border-neutral-700">
                {p}
              </button>
            ))}
          </div>

          {/* Image preview */}
          {previewUrl && (
            <div className="mb-3 inline-block relative">
              <div className="w-16 h-16 rounded-lg overflow-hidden border-2 border-[#71BF44]">
                <img src={previewUrl} alt="Preview" className="w-full h-full object-cover" />
              </div>
              <button onClick={clearFile}
                className="absolute -top-1.5 -right-1.5 bg-red-500 text-white rounded-full p-1 shadow hover:bg-red-600 transition-colors">
                <IconClose />
              </button>
            </div>
          )}

          {/* Text input row */}
          <div className="flex gap-2 items-end">
            {/* Attach */}
            <button type="button" onClick={() => fileRef.current?.click()}
              className="p-3 rounded-xl bg-neutral-100 dark:bg-[#1a1a1a] border border-neutral-200 dark:border-neutral-800 text-neutral-400 hover:text-[#71BF44] transition-colors shrink-0"
              title="Adjuntar imagen">
              <IconAttach />
            </button>
            <input type="file" ref={fileRef} onChange={handleFileChange} accept="image/*" className="hidden" />

            {/* Textarea + send */}
            <form onSubmit={handleSubmit} className="flex-1 flex items-end gap-2 bg-neutral-100 dark:bg-[#1a1a1a] rounded-xl border border-neutral-200 dark:border-neutral-800 focus-within:ring-2 focus-within:ring-[#71BF44]/40 focus-within:border-[#71BF44] transition-all overflow-hidden px-3 py-2">
              <textarea
                ref={textareaRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSubmit(e); } }}
                placeholder="Pregúntale a SARA... (Enter para enviar, Shift+Enter para nueva línea)"
                rows={1}
                className="flex-1 bg-transparent border-none outline-none resize-none text-sm text-neutral-900 dark:text-white placeholder-neutral-400 py-1 min-h-[36px] max-h-40"
              />
              <button type="submit"
                disabled={(!input.trim() && !selectedFile) || isLoading}
                className={`p-2 rounded-lg transition-all shrink-0 mb-0.5 ${
                  (input.trim() || selectedFile) && !isLoading
                    ? 'bg-[#71BF44] text-white hover:bg-[#5a9c33] shadow-sm shadow-[#71BF44]/20 hover:scale-105 active:scale-95'
                    : 'bg-neutral-200 dark:bg-neutral-700 text-neutral-400 dark:text-neutral-500 cursor-not-allowed'
                }`}>
                <IconSend />
              </button>
            </form>
          </div>

          {/* Footer note */}
          <p className="text-center text-[10px] text-neutral-400 dark:text-neutral-500 mt-2">
            SARA puede cometer errores · Verifica la información importante en los manuales oficiales
          </p>
        </div>
      </div>
    </div>
  );
}

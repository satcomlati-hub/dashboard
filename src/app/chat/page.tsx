'use client';

import React, { useState, useRef, useEffect, ChangeEvent } from 'react';
import { useSession } from 'next-auth/react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

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
  timestamp?: number;
};

type StoredSession = {
  id: string;
  title: string;
  preview: string;
  timestamp: number;
  messages: Message[];
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

// La función renderMarkdown ya no es necesaria con ReactMarkdown

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
  const [messages, setMessages]             = useState<Message[]>([]);
  const [input, setInput]                   = useState('');
  const [isLoading, setIsLoading]           = useState(false);
  const [selectedFile, setSelectedFile]     = useState<File | null>(null);
  const [previewUrl, setPreviewUrl]         = useState<string | null>(null);
  const [isDragging, setIsDragging]         = useState(false);

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
    createSession(true, true);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function createSession(initial = false, firstLoad = false) {
    const id = `sara_${newId()}`;
    const s: StoredSession = { id, title: 'Nueva sesión', preview: 'Inicia una consulta', timestamp: Date.now(), messages: [] };
    setSessions(prev => {
      const next = [s, ...prev];
      if (!initial) localStorage.setItem('sara_sessions', JSON.stringify(next));
      return next;
    });
    setActiveId(id);
    setMessages([]);
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
      
      // Sanitizar los mensajes para no guardar blobs pesados (Base64) en localStorage
      const sanitizedMessages = updated.map(m => ({
        ...m,
        userImage: null, // Evita guardar la imagen subida en localStorage
      }));

      const next = prev.map(s => s.id !== sid ? s : {
        ...s,
        title:     firstUser ? firstUser.content.slice(0, 40) || 'Sesión' : s.title,
        preview:   updated[updated.length - 1]?.content?.slice(0, 60) ?? '',
        timestamp: Date.now(),
        messages:  sanitizedMessages,
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

  const handleImageFile = (file: File) => {
    if (!file.type.startsWith('image/')) return;
    if (file.size > 10 * 1024 * 1024) { alert('Máximo 10MB.'); return; }
    setSelectedFile(file);
    const r = new FileReader();
    r.onloadend = () => setPreviewUrl(r.result as string);
    r.readAsDataURL(file);
  };

  const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleImageFile(file);
  };

  const handlePaste = (e: React.ClipboardEvent) => {
    const items = e.clipboardData?.items;
    if (!items) return;
    for (const item of Array.from(items)) {
      if (item.type.startsWith('image/')) {
        e.preventDefault();
        const file = item.getAsFile();
        if (file) handleImageFile(file);
        return;
      }
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) handleImageFile(file);
  };

  const handleSubmit = async (e: React.SyntheticEvent) => {
    e.preventDefault();
    if ((!input.trim() && !selectedFile) || isLoading) return;

    const userMsg: Message = { id: newId(), role: 'user', content: input, userImage: previewUrl, timestamp: Date.now() };
    const withUser = [...messages, userMsg];
    setMessages(withUser);
    const q = input, f = selectedFile, sid = activeSessionId;
    setInput('');
    clearFile();
    setIsLoading(true);

    try {
      // Si hay imagen, subirla a Supabase Storage primero
      let imageUrl: string | null = null;
      if (f) {
        const uploadFd = new FormData();
        uploadFd.append('image', f);
        const uploadRes = await fetch('/api/upload-image', { method: 'POST', body: uploadFd });
        if (uploadRes.ok) {
          const uploadData = await uploadRes.json();
          imageUrl = uploadData.url;
        }
      }

      const fd = new FormData();
      fd.append('query', q);
      fd.append('sessionId', sid);
      if (session?.user?.name) fd.append('userName', session.user.name);
      if (session?.user?.email) fd.append('userEmail', session.user.email);
      if (imageUrl) fd.append('imageUrl', imageUrl);
      if (f) fd.append('image', f);

      const res = await fetch('/api/chat', { method: 'POST', body: fd });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);

      if (res.body) {
        // ── Streaming NDJSON (formato n8n: {"type":"item","content":"..."}) ──
        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let buffer = '';
        let accumulated = '';
        let streamMsgId: string | null = null;
        let streamImages: ImageAttachment[] = [];
        let imgAccumulating = false;
        let imgBuffer = '';

        const processChunk = (rawContent: string) => {
          // Una vez que empieza [[IMGS]]: acumular URLs sin mostrar en pantalla
          if (imgAccumulating) {
            imgBuffer += rawContent;
            return;
          }

          const markerIdx = rawContent.indexOf('[[IMGS]]:');
          let chunk = rawContent;
          if (markerIdx !== -1) {
            imgAccumulating = true;
            imgBuffer = rawContent.slice(markerIdx + '[[IMGS]]:'.length);
            chunk = rawContent.slice(0, markerIdx).trimEnd();
          }

          if (!chunk) return;
          if (!streamMsgId) {
            streamMsgId = newId();
            accumulated = chunk;
            setIsLoading(false);
            const displayContent = accumulated.replace(/Calling\s+[\w-]+\s+with\s+input:\s*\{[\s\S]*?\}\n*/g, '').trimStart();
            setMessages([...withUser, { id: streamMsgId, role: 'assistant', content: displayContent, timestamp: Date.now() }]);
          } else {
            accumulated += chunk;
            const displayContent = accumulated.replace(/Calling\s+[\w-]+\s+with\s+input:\s*\{[\s\S]*?\}\n*/g, '').trimStart();
            setMessages(prev => prev.map(m => m.id === streamMsgId ? { ...m, content: displayContent } : m));
          }
        };

        const processLine = (trimmed: string) => {
          if (!trimmed) return;
          try {
            const parsed = JSON.parse(trimmed);
            if (parsed.type !== 'item' || !parsed.content) return;
            processChunk(parsed.content as string);
          } catch { /* línea no parseable, ignorar */ }
        };

        try {
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split('\n');
            buffer = lines.pop() ?? '';
            for (const line of lines) processLine(line.trim());
          }
          if (buffer.trim()) processLine(buffer.trim());
        } finally {
          reader.releaseLock();
        }

        // Extraer imágenes del buffer acumulado tras el stream
        console.log('[SARA-DBG2] imgAccumulating:', imgAccumulating, '| imgBuffer len:', imgBuffer.length);
        console.log('[SARA-DBG2] imgBuffer raw:', JSON.stringify(imgBuffer.slice(0, 300)));
        if (imgAccumulating && imgBuffer) {
          const urlString = imgBuffer.replace(/[\n\r]/g, '');
          const parts = urlString.split('|');
          console.log('[SARA-DBG2] parts after split:', parts.length, parts.map(p => p.slice(0, 60)));
          const urls = parts.map(u => u.trim()).filter(u => u.startsWith('http'));
          console.log('[SARA-DBG2] final urls:', urls.length, urls);
          if (urls.length > 0) streamImages = urls.map(url => ({ url }));
        }

        if (!streamMsgId) {
          streamMsgId = newId();
          setIsLoading(false);
          setMessages([...withUser, { id: streamMsgId, role: 'assistant', content: 'Sin respuesta.' }]);
        }

        // Aplicar imágenes al mensaje final si el agente las incluyó
        if (streamImages.length > 0) {
          setMessages(prev =>
            prev.map(m => m.id === streamMsgId ? { ...m, images: streamImages } : m)
          );
        }

        const displayContent = accumulated.replace(/Calling\s+[\w-]+\s+with\s+input:\s*\{[\s\S]*?\}\n*/g, '').trimStart();
        const finalMsg: Message = { id: streamMsgId, role: 'assistant', content: displayContent || 'Sin respuesta.', images: streamImages, timestamp: Date.now() };
        persist([...withUser, finalMsg], sid);

      } else {
        // ── JSON (fallback sin body streameable) ────────────────────────────
        const data = await res.json();
        const saraMsg: Message = {
          id: newId(), role: 'assistant',
          content: data.response || 'Sin respuesta.',
          images:  data.images  || [],
          sources: data.sources || [],
          timestamp: Date.now(),
        };
        const final = [...withUser, saraMsg];
        setMessages(final);
        persist(final, sid);
      }

    } catch {
      const err: Message = { id: newId(), role: 'assistant', content: 'Error al conectar con SARA. Verifica que n8n esté activo.' };
      const final = [...withUser, err];
      setMessages(final);
      persist(final, sid);
    } finally {
      setIsLoading(false);
    }
  };


  // ─── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="flex h-[calc(100vh-64px)] lg:h-screen bg-[#fafafa] dark:bg-[#131313] font-sans selection:bg-[#71BF44]/30 selection:text-[#71BF44]">

      {/* ── History sidebar ──────────────────────────────────────────────────── */}
      <aside className="w-64 shrink-0 flex flex-col bg-white/50 dark:bg-[#1b1b1b]/50 backdrop-blur-xl border-r border-black/5 dark:border-white/5 z-10 relative">
        {/* Header */}
        <div className="px-5 py-4 flex items-center justify-between">
          <span className="text-[11px] font-bold uppercase tracking-widest text-neutral-400 dark:text-neutral-500">Historial de SARA</span>
          <button
            onClick={() => createSession()}
            className="p-1.5 rounded-lg hover:bg-black/5 dark:hover:bg-white/5 text-neutral-400 hover:text-[#71BF44] transition-colors"
            title="Nueva sesión"
          >
            <IconPlus />
          </button>
        </div>

        {/* Session list */}
        <div className="flex-1 overflow-y-auto py-2 px-3 space-y-1" style={{ scrollbarWidth: 'none' }}>
          {sessions.length === 0 && (
            <p className="px-4 py-3 text-xs text-neutral-400 dark:text-neutral-500">Sin sesiones previas</p>
          )}
          {sessions.map((s) => {
            const active = s.id === activeSessionId;
            return (
              <div key={s.id} className="group relative">
                <button
                  onClick={() => switchSession(s)}
                  className={`w-full text-left px-3 py-2.5 rounded-xl transition-all ${
                    active
                      ? 'bg-white dark:bg-[#353535] shadow-sm ring-1 ring-black/5 dark:ring-white/5'
                      : 'hover:bg-white/60 dark:hover:bg-[#1f1f1f]/60'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2 mb-1">
                    <span className={`text-xs truncate max-w-[120px] ${active ? 'font-bold text-neutral-900 dark:text-neutral-100' : 'font-medium text-neutral-600 dark:text-neutral-400'}`}>
                      {s.title}
                    </span>
                    <span className="text-[9px] text-neutral-400/80 shrink-0 mt-0.5 group-hover:opacity-0 transition-opacity">{formatTime(s.timestamp)}</span>
                  </div>
                  <p className={`text-[10px] truncate pr-6 ${active ? 'text-neutral-500 dark:text-neutral-400' : 'text-neutral-400/80 dark:text-neutral-500'}`}>{s.preview}</p>
                </button>
                <button
                  onClick={(e) => { e.stopPropagation(); deleteSession(s.id); }}
                  className="absolute right-2 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 p-1.5 text-neutral-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-lg transition-all"
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
      <div className="flex-1 flex flex-col min-w-0 bg-[url('/noise.png')] bg-repeat opacity-[0.98]">
        
        {/* Chat header */}
        <div className="shrink-0 px-6 md:px-8 py-5 flex items-center justify-between sticky top-0 z-20 bg-[#fafafa]/80 dark:bg-[#131313]/80 backdrop-blur-md border-b border-black/5 dark:border-white/5">
          <div className="flex items-center gap-3.5">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#71BF44] to-[#5a9c33] flex items-center justify-center text-white shadow-lg shadow-[#71BF44]/20 ring-1 ring-black/5">
              <IconSara />
            </div>
            <div>
              <h2 className="text-sm font-bold text-neutral-900 dark:text-neutral-100">AI Assistant: SARA</h2>
              <div className="flex items-center gap-1.5 mt-0.5">
                <span className="w-1.5 h-1.5 rounded-full bg-[#71BF44] shadow-[0_0_8px_#71BF44] animate-pulse" />
                <span className="text-[10px] font-bold text-neutral-500 dark:text-neutral-400 uppercase tracking-widest">Sistema Óptimo</span>
              </div>
            </div>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => {
                setMessages([]);
                persist([], activeSessionId);
              }}
              className="px-4 py-2 text-[10px] font-bold rounded-lg bg-white/50 dark:bg-[#1f1f1f]/50 hover:bg-white dark:hover:bg-[#2a2a2a] text-neutral-600 dark:text-neutral-400 transition-colors uppercase tracking-wider ring-1 ring-black/5 dark:ring-white/5"
            >
              Limpiar
            </button>
          </div>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto px-6 md:px-12 lg:px-24 py-8">
          {messages.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center max-w-3xl mx-auto text-center space-y-12 animate-in fade-in zoom-in-95 duration-700">
              <div className="space-y-4">
                <h1 className="text-5xl md:text-6xl font-bold tracking-tight text-neutral-900 dark:text-white">
                  Hola, {session?.user?.name?.split(' ')[0] || 'invitado'}
                </h1>
                <h2 className="text-xl md:text-2xl font-medium text-neutral-500 dark:text-neutral-400">
                  ¿Cómo puedo ayudarte a orquestar el trabajo hoy?
                </h2>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 w-full max-w-2xl">
                {[
                  { title: 'Análisis de manuales', desc: 'Explora la documentación técnica de SATCOM.', icon: '📚' },
                  { title: 'Visión por IA', desc: 'Sube una imagen para que la analice en detalle.', icon: '👁️' },
                  { title: 'Soporte Técnico', desc: 'Pregúntame sobre procedimientos o fallas.', icon: '🔧' },
                  { title: 'Consultas RAG', desc: 'Busco información precisa en nuestra base de conocimientos.', icon: '🔍' },
                ].map((item, idx) => (
                  <button
                    key={idx}
                    onClick={() => {
                      setInput(item.title);
                      textareaRef.current?.focus();
                    }}
                    className="flex flex-col items-start p-5 rounded-2xl bg-white/40 dark:bg-[#1f1f1f]/40 backdrop-blur-sm border border-black/5 dark:border-white/5 hover:bg-white dark:hover:bg-[#2a2a2a] hover:border-[#71BF44]/30 hover:shadow-xl hover:shadow-[#71BF44]/5 transition-all text-left group"
                  >
                    <span className="text-2xl mb-3">{item.icon}</span>
                    <span className="text-sm font-bold text-neutral-900 dark:text-neutral-100 group-hover:text-[#71BF44] transition-colors">{item.title}</span>
                    <span className="text-xs text-neutral-500 dark:text-neutral-400 mt-1.5 leading-relaxed">{item.desc}</span>
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <div className="space-y-8 max-w-4xl mx-auto">
              {messages.map((m) => (
                <div key={m.id} className={`flex gap-4 animate-in fade-in slide-in-from-bottom-4 ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                  {m.role === 'assistant' && (
                    <div className="w-8 h-8 rounded-full bg-gradient-to-br from-[#71BF44] to-[#5a9c33] flex items-center justify-center text-white shrink-0 mt-1 shadow-md shadow-[#71BF44]/20 ring-2 ring-white dark:ring-[#131313]">
                      <span className="font-bold text-[11px]">S</span>
                    </div>
                  )}

                  <div className={`max-w-[85%] flex flex-col gap-2 ${m.role === 'user' ? 'items-end' : 'items-start'}`}>
                    {/* Bubble */}
                    <div className={`px-5 py-4 rounded-3xl text-[15px] leading-relaxed shadow-sm ${
                      m.role === 'user'
                        ? 'bg-neutral-900 dark:bg-neutral-100 text-white dark:text-neutral-900 rounded-tr-sm font-medium'
                        : 'bg-white dark:bg-[#1f1f1f] border border-black/5 dark:border-white/5 text-neutral-800 dark:text-neutral-200 rounded-tl-sm'
                    }`}>
                      {m.userImage && (
                        <img src={m.userImage} alt="adjunto" className="rounded-xl max-h-64 object-cover mb-3 ring-1 ring-black/5 dark:ring-white/5" />
                      )}
                      {m.content && (
                        <div className={`markdown-content ${m.role === 'user' ? 'opacity-90' : ''}`}>
                          <ReactMarkdown
                            remarkPlugins={[remarkGfm]}
                            components={{
                              p: ({ children }) => <p className="mb-3 last:mb-0">{children}</p>,
                              h1: ({ children }) => <h1 className="text-xl font-bold mb-3 tracking-tight">{children}</h1>,
                              h2: ({ children }) => <h2 className="text-lg font-bold mb-3 tracking-tight">{children}</h2>,
                              h3: ({ children }) => <h3 className="text-base font-bold mb-2 tracking-tight">{children}</h3>,
                              ul: ({ children }) => <ul className="list-disc ml-5 mb-3 space-y-1">{children}</ul>,
                              ol: ({ children }) => <ol className="list-decimal ml-5 mb-3 space-y-1">{children}</ol>,
                              li: ({ children }) => <li>{children}</li>,
                              strong: ({ children }) => <strong className="font-bold text-[#71BF44]">{children}</strong>,
                              a: ({ href, children }) => (
                                <a href={href} target="_blank" rel="noopener noreferrer"
                                   className="text-[#71BF44] border-b border-[#71BF44]/30 hover:border-[#71BF44] transition-colors pb-0.5">
                                  {children}
                                </a>
                              ),
                              code: ({ children }) => (
                                <code className="bg-neutral-100 dark:bg-neutral-800/80 px-1.5 py-0.5 rounded-md text-[13px] font-mono text-neutral-800 dark:text-neutral-200">
                                  {children}
                                </code>
                              ),
                              pre: ({ children }) => (
                                <pre className="bg-[#0e0e0e] text-neutral-300 p-4 rounded-xl overflow-x-auto text-[13px] font-mono my-3 shadow-inner">
                                  {children}
                                </pre>
                              ),
                              blockquote: ({ children }) => (
                                <blockquote className="border-l-4 border-[#71BF44] bg-[#71BF44]/5 py-2 pr-4 pl-4 italic my-3 rounded-r-lg">
                                  {children}
                                </blockquote>
                              ),
                              img: ({ src, alt }) => {
                                const imgSrc = typeof src === 'string' ? src : undefined;
                                return (
                                <a href={imgSrc} target="_blank" rel="noopener noreferrer" className="group relative block overflow-hidden rounded-xl border border-black/5 dark:border-white/5 bg-white dark:bg-[#1a1a1a] my-3">
                                  <img src={imgSrc} alt={alt || 'Imagen del manual'}
                                    className="max-h-80 w-full object-contain group-hover:scale-[1.02] transition-transform duration-500" />
                                  <div className="absolute inset-0 ring-1 ring-inset ring-black/10 group-hover:ring-[#71BF44]/50 transition-colors rounded-xl" />
                                  {alt && <p className="text-xs text-neutral-500 dark:text-neutral-400 px-3 py-1.5 text-center bg-white/80 dark:bg-[#1a1a1a]/80">{alt}</p>}
                                </a>
                                );
                              },
                            }}
                          >
                            {m.content}
                          </ReactMarkdown>
                        </div>
                      )}
                    </div>

                    {/* RAG images */}
                    {m.images && m.images.length > 0 && (
                      <div className={`flex flex-wrap gap-3 mt-1 ${m.images.length > 1 ? 'grid grid-cols-2' : ''}`}>
                        {m.images.map((img, i) => {
                          const src = img.url || (img.base64 ? `data:image/jpeg;base64,${img.base64}` : null);
                          if (!src) return null;
                          return (
                            <a key={i} href={img.sourceUrl || src} target="_blank" rel="noopener noreferrer" className="group relative block overflow-hidden rounded-xl border border-black/5 dark:border-white/5 bg-white dark:bg-[#1a1a1a]">
                              <img src={src} alt={img.filename || `Ref. ${i + 1}`}
                                className="max-h-48 w-full object-cover group-hover:scale-105 transition-transform duration-500" />
                              <div className="absolute inset-0 ring-1 ring-inset ring-black/10 group-hover:ring-[#71BF44]/50 transition-colors rounded-xl" />
                            </a>
                          );
                        })}
                      </div>
                    )}

                    {/* Sources */}
                    {m.sources && m.sources.length > 0 && (
                      <div className="flex flex-wrap gap-2 mt-1">
                        {m.sources.map((src, i) => (
                          <a key={i} href={src.url} target="_blank" rel="noopener noreferrer"
                            className="inline-flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg bg-white dark:bg-[#1f1f1f] border border-black/5 dark:border-white/5 text-neutral-600 dark:text-neutral-400 hover:text-[#71BF44] hover:border-[#71BF44]/30 shadow-sm transition-all group">
                            <IconExternalLink />
                            <span className="truncate max-w-[200px]">{src.title || 'Ver documento'}</span>
                          </a>
                        ))}
                      </div>
                    )}
                    {/* Timestamp */}
                      {m.timestamp && (
                        <span className="text-[10px] text-neutral-400 dark:text-neutral-500 mt-1 px-2">
                          {new Date(m.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      )}
                    </div>

                  {m.role === 'user' && (
                    <div className="w-8 h-8 rounded-full bg-neutral-200 dark:bg-neutral-800 flex items-center justify-center shrink-0 mt-1 ring-2 ring-white dark:ring-[#131313]">
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="text-neutral-500 dark:text-neutral-400">
                        <path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" />
                      </svg>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* Loading indicator */}
          {isLoading && (
            <div className="flex gap-4 justify-start max-w-4xl mx-auto mt-8 animate-in fade-in">
              <div className="w-8 h-8 rounded-full bg-gradient-to-br from-[#71BF44] to-[#5a9c33] flex items-center justify-center text-white shrink-0 mt-1 shadow-md shadow-[#71BF44]/20 ring-2 ring-white dark:ring-[#131313] animate-pulse">
                <span className="font-bold text-[11px]">S</span>
              </div>
              <div className="px-5 py-4 rounded-3xl rounded-tl-sm bg-white dark:bg-[#1f1f1f] border border-black/5 dark:border-white/5 shadow-sm flex gap-1.5 items-center">
                {[0, 150, 300].map(d => (
                  <span key={d} className="w-2 h-2 rounded-full bg-neutral-400 dark:bg-neutral-500 animate-bounce" style={{ animationDelay: `${d}ms` }} />
                ))}
              </div>
            </div>
          )}

          <div ref={endRef} className="h-8" />
        </div>

        {/* ── Input area ──────────────────────────────────────────────────────── */}
        <div className="shrink-0 pb-6 px-6 md:px-12 lg:px-24 w-full max-w-5xl mx-auto relative z-20">

          <div
            className={`bg-white/80 dark:bg-[#1f1f1f]/80 backdrop-blur-xl rounded-3xl p-3 shadow-[0_8px_30px_rgb(0,0,0,0.04)] dark:shadow-[0_8px_30px_rgb(0,0,0,0.2)] border transition-colors relative ${
              isDragging
                ? 'border-[#71BF44] border-2 bg-[#71BF44]/5'
                : 'border-black/5 dark:border-white/5'
            }`}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
          >
            {/* Drag overlay */}
            {isDragging && (
              <div className="absolute inset-0 rounded-3xl bg-[#71BF44]/10 border-2 border-dashed border-[#71BF44] flex items-center justify-center z-30 pointer-events-none">
                <span className="text-[#71BF44] font-bold text-sm">Suelta la imagen aquí</span>
              </div>
            )}
            {/* Image preview */}
            {previewUrl && (
              <div className="mb-3 ml-3 relative inline-block animate-in zoom-in-95">
                <div className="w-16 h-16 rounded-xl overflow-hidden border-2 border-[#71BF44] shadow-sm">
                  <img src={previewUrl} alt="Preview" className="w-full h-full object-cover" />
                </div>
                <button onClick={clearFile}
                  className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-1 shadow-md hover:bg-red-600 transition-colors">
                  <IconClose />
                </button>
              </div>
            )}

            {/* Text input row */}
            <div className="flex gap-2 items-end">
              {/* Attach */}
              <button type="button" onClick={() => fileRef.current?.click()}
                className="p-3.5 rounded-2xl hover:bg-neutral-100 dark:hover:bg-[#2a2a2a] text-neutral-400 hover:text-[#71BF44] transition-colors shrink-0"
                title="Adjuntar imagen">
                <IconAttach />
              </button>
              <input type="file" ref={fileRef} onChange={handleFileChange} accept="image/*" className="hidden" />

              {/* Textarea + send */}
              <form onSubmit={handleSubmit} className="flex-1 flex items-end gap-2 px-1">
                <textarea
                  ref={textareaRef}
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSubmit(e); } }}
                  onPaste={handlePaste}
                  placeholder="Instruye a SARA..."
                  rows={1}
                  className="flex-1 bg-transparent border-none outline-none resize-none text-[15px] text-neutral-900 dark:text-neutral-100 placeholder-neutral-400 dark:placeholder-neutral-500 py-3.5 min-h-[48px] max-h-40"
                  style={{ scrollbarWidth: 'none' }}
                />
                <button type="submit"
                  disabled={(!input.trim() && !selectedFile) || isLoading}
                  className={`p-3 rounded-xl transition-all shrink-0 mb-1 ${
                    (input.trim() || selectedFile) && !isLoading
                      ? 'bg-[#71BF44] text-white hover:bg-[#5a9c33] shadow-md shadow-[#71BF44]/25 hover:-translate-y-0.5'
                      : 'bg-neutral-100 dark:bg-[#2a2a2a] text-neutral-300 dark:text-neutral-600 cursor-not-allowed'
                  }`}>
                  <IconSend />
                </button>
              </form>
            </div>
          </div>

          {/* Footer note */}
          <p className="text-center text-[10px] font-medium text-neutral-400 dark:text-neutral-500 mt-4 tracking-wide">
            SARA PUEDE COMETER ERRORES · VERIFICA LA INFORMACIÓN IMPORTANTE EN LOS MANUALES OFICIALES
          </p>
        </div>
      </div>
    </div>
  );
}

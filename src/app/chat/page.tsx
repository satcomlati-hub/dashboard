'use client';

import React, { useState, useRef, useEffect, ChangeEvent } from 'react';

type ImageAttachment = {
  url?: string | null;
  base64?: string | null;
  filename?: string;
  sourceUrl?: string;
};

type Source = {
  url: string;
  title?: string;
};

type Message = {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  images?: ImageAttachment[];
  sources?: Source[];
  userImage?: string | null;
};

function renderMarkdown(text: string) {
  const parts: React.ReactNode[] = [];
  const regex = /(\*\*(.+?)\*\*)|(\[([^\]]+)\]\(([^)]+)\))/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  let key = 0;

  while ((match = regex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      parts.push(text.slice(lastIndex, match.index));
    }
    if (match[1]) {
      parts.push(<strong key={key++}>{match[2]}</strong>);
    } else if (match[3]) {
      parts.push(
        <a
          key={key++}
          href={match[5]}
          target="_blank"
          rel="noopener noreferrer"
          className="text-[#71BF44] underline underline-offset-2 hover:text-[#5a9c33] transition-colors"
        >
          {match[4]}
        </a>
      );
    }
    lastIndex = match.index + match[0].length;
  }

  if (lastIndex < text.length) {
    parts.push(text.slice(lastIndex));
  }

  return parts;
}

export default function SaraChatPage() {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: 'welcome',
      role: 'assistant',
      content: '¡Hola! Soy SARA, tu asistente de Inteligencia Artificial. ¿En qué te puedo ayudar hoy con los manuales de la empresa?',
    }
  ]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const sessionId = 'satcom_user_session_main';

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 10 * 1024 * 1024) {
        alert('La imagen es demasiado grande. Máximo 10MB.');
        return;
      }
      setSelectedFile(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setPreviewUrl(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const removeSelectedFile = () => {
    setSelectedFile(null);
    setPreviewUrl(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleSubmit = async (e: React.SyntheticEvent) => {
    e.preventDefault();
    if ((!input.trim() && !selectedFile) || isLoading) return;

    const userMsg: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: input,
      userImage: previewUrl
    };

    setMessages((prev) => [...prev, userMsg]);
    const currentInput = input;
    const currentFile = selectedFile;

    setInput('');
    removeSelectedFile();
    setIsLoading(true);

    try {
      const formData = new FormData();
      formData.append('query', currentInput);
      formData.append('sessionId', sessionId);
      if (currentFile) {
        formData.append('image', currentFile);
      }

      const response = await fetch('/api/chat', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        throw new Error('Error al contactar a SARA');
      }

      const data = await response.json();

      const saraMsg: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: data.response || 'No pude generar una respuesta. Por favor intenta de nuevo.',
        images: data.images || [],
        sources: data.sources || [],
      };

      setMessages((prev) => [...prev, saraMsg]);
    } catch (error) {
      console.error(error);
      const errorMsg: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: 'Lo siento, ocurrió un error al intentar conectarme al cerebro de SARA. Asegúrate de haber configurado mis credenciales en n8n.',
      };
      setMessages((prev) => [...prev, errorMsg]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex flex-col h-[calc(100vh-theme(spacing.16))] lg:h-screen w-full bg-neutral-50 dark:bg-[#0a0a0a]">
      {/* Header */}
      <header className="flex-shrink-0 border-b border-neutral-200 dark:border-neutral-800 bg-white dark:bg-[#0e0e0e] px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#71BF44] to-[#5a9c33] flex items-center justify-center text-white shadow-lg shadow-[#71BF44]/20">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 8V4H8" />
              <rect width="16" height="12" x="4" y="8" rx="2" />
              <path d="M2 14h2" />
              <path d="M20 14h2" />
              <path d="M15 13v2" />
              <path d="M9 13v2" />
            </svg>
          </div>
          <div>
            <h1 className="text-xl font-bold text-neutral-900 dark:text-white leading-tight">SARA</h1>
            <p className="text-xs font-medium text-neutral-500 dark:text-neutral-400">Satcom AI Assistant</p>
          </div>
        </div>
      </header>

      {/* Chat Messages */}
      <main className="flex-1 overflow-y-auto w-full flex flex-col items-center p-4">
        <div className="w-full max-w-3xl flex flex-col gap-6 py-4">
          {messages.map((m) => (
            <div key={m.id} className={`flex w-full ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              <div className={`flex gap-4 max-w-[85%] ${m.role === 'user' ? 'flex-row-reverse' : 'flex-row'}`}>
                {/* Avatar */}
                <div className="flex-shrink-0 mt-1">
                  {m.role === 'assistant' ? (
                    <div className="w-8 h-8 rounded-full bg-gradient-to-br from-[#71BF44] to-[#5a9c33] flex items-center justify-center text-white shadow-md">
                      <span className="font-bold text-xs">S</span>
                    </div>
                  ) : (
                    <div className="w-8 h-8 rounded-full bg-neutral-200 dark:bg-neutral-800 border border-neutral-300 dark:border-neutral-700 flex items-center justify-center text-neutral-600 dark:text-neutral-400">
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2" />
                        <circle cx="12" cy="7" r="4" />
                      </svg>
                    </div>
                  )}
                </div>

                {/* Bubble */}
                <div className={`px-5 py-3.5 flex flex-col gap-3 rounded-2xl ${
                  m.role === 'user'
                    ? 'bg-neutral-900 dark:bg-white text-white dark:text-neutral-900 rounded-tr-sm'
                    : 'bg-white dark:bg-[#1a1a1a] border border-neutral-200 dark:border-neutral-800 text-neutral-800 dark:text-neutral-200 rounded-tl-sm shadow-sm'
                }`}>
                  {/* Imagen enviada por el usuario */}
                  {m.userImage && (
                    <img src={m.userImage} alt="Enviado por usuario" className="rounded-lg max-h-64 object-contain shadow-sm border border-neutral-700/20" />
                  )}

                  {/* Texto con markdown */}
                  {m.content && (
                    <p className="whitespace-pre-wrap leading-relaxed text-sm md:text-base">
                      {renderMarkdown(m.content)}
                    </p>
                  )}

                  {/* Imagenes de respuesta del RAG */}
                  {m.images && m.images.length > 0 && (
                    <div className={`flex flex-wrap gap-2 ${m.images.length === 1 ? '' : 'grid grid-cols-2'}`}>
                      {m.images.map((img, idx) => {
                        const src = img.url || (img.base64 ? `data:image/jpeg;base64,${img.base64}` : null);
                        if (!src) return null;
                        return (
                          <a
                            key={idx}
                            href={img.sourceUrl || src}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="block group"
                          >
                            <img
                              src={src}
                              alt={img.filename || `Referencia ${idx + 1}`}
                              className="rounded-lg max-h-56 object-contain shadow-sm border border-neutral-200 dark:border-neutral-800 group-hover:ring-2 group-hover:ring-[#71BF44]/50 transition-all"
                            />
                          </a>
                        );
                      })}
                    </div>
                  )}

                  {/* Fuentes */}
                  {m.sources && m.sources.length > 0 && (
                    <div className="flex flex-wrap gap-2 pt-1 border-t border-neutral-100 dark:border-neutral-800">
                      {m.sources.map((src, idx) => (
                        <a
                          key={idx}
                          href={src.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-full bg-[#71BF44]/10 text-[#71BF44] hover:bg-[#71BF44]/20 transition-colors"
                        >
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
                            <polyline points="15 3 21 3 21 9" />
                            <line x1="10" y1="14" x2="21" y2="3" />
                          </svg>
                          {src.title || 'Ver manual'}
                        </a>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))}
          {isLoading && (
            <div className="flex w-full justify-start">
              <div className="flex gap-4 max-w-[85%]">
                <div className="flex-shrink-0 mt-1">
                  <div className="w-8 h-8 rounded-full bg-gradient-to-br from-[#71BF44] to-[#5a9c33] flex items-center justify-center text-white shadow-md animate-pulse">
                    <span className="font-bold text-xs">S</span>
                  </div>
                </div>
                <div className="px-5 py-4 rounded-2xl bg-white dark:bg-[#1a1a1a] border border-neutral-200 dark:border-neutral-800 rounded-tl-sm shadow-sm flex gap-1.5 items-center">
                  <span className="w-2 h-2 rounded-full bg-neutral-400 dark:bg-neutral-600 animate-bounce" style={{ animationDelay: '0ms' }} />
                  <span className="w-2 h-2 rounded-full bg-neutral-400 dark:bg-neutral-600 animate-bounce" style={{ animationDelay: '150ms' }} />
                  <span className="w-2 h-2 rounded-full bg-neutral-400 dark:bg-neutral-600 animate-bounce" style={{ animationDelay: '300ms' }} />
                </div>
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>
      </main>

      {/* Input Area */}
      <footer className="w-full bg-white dark:bg-[#0e0e0e] border-t border-neutral-200 dark:border-neutral-800 p-4 shrink-0">
        <div className="max-w-3xl mx-auto flex flex-col gap-3">
          {/* Preview de imagen seleccionada */}
          {previewUrl && (
            <div className="relative inline-block w-24 h-24 rounded-lg overflow-hidden border-2 border-[#71BF44] bg-neutral-100 dark:bg-neutral-800">
              <img src={previewUrl} alt="Preview" className="w-full h-full object-cover" />
              <button
                onClick={removeSelectedFile}
                className="absolute top-1 right-1 bg-red-500 text-white rounded-full p-1 shadow-md hover:bg-red-600 transition-colors"
              >
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </div>
          )}

          <div className="flex gap-2 items-end">
            {/* Boton Adjuntar */}
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="p-3.5 rounded-2xl bg-neutral-100 dark:bg-[#1a1a1a] border border-neutral-200 dark:border-neutral-800 text-neutral-500 hover:text-[#71BF44] transition-all"
              title="Adjuntar imagen"
            >
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="m21.44 11.05-9.19 9.19a6 6 0 0 1-8.49-8.49l8.57-8.57A4 4 0 1 1 18 8.84l-8.59 8.51a2 2 0 0 1-2.83-2.83l8.49-8.48" />
              </svg>
            </button>
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileChange}
              accept="image/*"
              className="hidden"
            />

            <form
              onSubmit={handleSubmit}
              className="flex-1 relative flex items-end overflow-hidden bg-neutral-100 dark:bg-[#1a1a1a] rounded-2xl border border-neutral-200 dark:border-neutral-800 focus-within:ring-2 focus-within:ring-[#71BF44]/50 focus-within:border-[#71BF44] transition-all"
            >
              <textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    handleSubmit(e);
                  }
                }}
                placeholder="Pregúntale a SARA..."
                className="w-full max-h-48 min-h-[56px] py-4 pl-4 pr-12 bg-transparent text-neutral-900 dark:text-white placeholder-neutral-500 resize-none outline-none text-base"
                rows={1}
              />
              <button
                type="submit"
                disabled={(!input.trim() && !selectedFile) || isLoading}
                className={`absolute right-2 bottom-2 p-2 rounded-xl transition-all ${
                  (input.trim() || selectedFile) && !isLoading
                    ? 'bg-[#71BF44] text-white hover:bg-[#5a9c33] shadow-md shadow-[#71BF44]/20'
                    : 'bg-neutral-200 dark:bg-neutral-800 text-neutral-400 dark:text-neutral-600 cursor-not-allowed'
                }`}
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="22" y1="2" x2="11" y2="13" />
                  <polygon points="22 2 15 22 11 13 2 9 22 2" />
                </svg>
              </button>
            </form>
          </div>

          <div className="text-center mt-1">
            <p className="text-xs text-neutral-500 dark:text-neutral-500">SARA puede cometer errores. Considera verificar la información importante en los manuales oficiales de Zoho.</p>
          </div>
        </div>
      </footer>
    </div>
  );
}

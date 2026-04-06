'use client';

import React, { useState, useRef, useEffect } from 'react';

// Estilos de la interfaz de SARA
type Message = {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  imageUrl?: string | null;
  imageBase64?: string | null;
};

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
  const messagesEndRef = useRef<HTMLDivElement>(null);
  
  // Usamos una sesión fija para mantener el contexto del usuario logueado en Satcom.
  // En un entorno de producción con Auth real, esto vendría del JWT o la sesión.
  const sessionId = 'satcom_user_session_main';

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isLoading) return;

    const userMsg: Message = { id: Date.now().toString(), role: 'user', content: input };
    setMessages((prev) => [...prev, userMsg]);
    setInput('');
    setIsLoading(true);

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: userMsg.content, sessionId }),
      });

      if (!response.ok) {
        throw new Error('Error al contactar a SARA');
      }

      const data = await response.json();
      
      const saraMsg: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: data.response || 'No pude generar una respuesta. Por favor intenta de nuevo.',
        imageUrl: data.image_url,
        imageBase64: data.image_base64
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
                  {m.imageUrl ? (
                    <img src={m.imageUrl} alt="SARA reference" className="rounded-lg max-h-64 object-contain shadow-sm border border-neutral-200 dark:border-neutral-800" />
                  ) : m.imageBase64 ? (
                    <img src={`data:image/jpeg;base64,${m.imageBase64}`} alt="SARA reference" className="rounded-lg max-h-64 object-contain shadow-sm border border-neutral-200 dark:border-neutral-800" />
                  ) : null}
                  <p className="whitespace-pre-wrap leading-relaxed text-sm md:text-base">
                    {m.content}
                  </p>
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
        <div className="max-w-3xl mx-auto">
          <form 
            onSubmit={handleSubmit}
            className="relative flex items-end overflow-hidden bg-neutral-100 dark:bg-[#1a1a1a] rounded-2xl border border-neutral-200 dark:border-neutral-800 focus-within:ring-2 focus-within:ring-[#71BF44]/50 focus-within:border-[#71BF44] transition-all"
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
              disabled={!input.trim() || isLoading}
              className={`absolute right-2 bottom-2 p-2 rounded-xl transition-all ${
                input.trim() && !isLoading 
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
          <div className="text-center mt-3">
             <p className="text-xs text-neutral-500 dark:text-neutral-500">SARA puede cometer errores. Considera verificar la información importante en los manuales oficiales de Zoho.</p>
          </div>
        </div>
      </footer>
    </div>
  );
}

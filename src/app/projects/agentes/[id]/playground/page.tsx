'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';

type Message = { role: 'user' | 'assistant'; content: string; streaming?: boolean };

export default function PlaygroundPage() {
  const { id } = useParams<{ id: string }>();
  const [agent, setAgent] = useState<any>(null);
  const [apiKey, setApiKey] = useState('');
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetch(`/api/agentes/v1/agents/${id}`).then(r => r.json()).then(setAgent);
  }, [id]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const send = async () => {
    if (!input.trim() || loading || !apiKey) return;
    const prompt = input.trim();
    setInput('');
    setMessages(m => [...m, { role: 'user', content: prompt }]);
    setLoading(true);

    const assistantIdx = messages.length + 1;
    setMessages(m => [...m, { role: 'assistant', content: '', streaming: true }]);

    try {
      const res = await fetch(`/api/agentes/v1/agents/${id}/invoke/stream`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({ prompt }),
      });

      if (!res.ok) {
        const err = await res.text();
        setMessages(m => m.map((msg, i) => i === assistantIdx ? { ...msg, content: `Error: ${err}`, streaming: false } : msg));
        return;
      }

      const reader = res.body?.getReader();
      const decoder = new TextDecoder();
      if (!reader) return;

      let buffer = '';
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() ?? '';
        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = line.slice(6);
            setMessages(m => m.map((msg, i) =>
              i === assistantIdx ? { ...msg, content: msg.content + data } : msg
            ));
          } else if (line.startsWith('event: done')) {
            setMessages(m => m.map((msg, i) => i === assistantIdx ? { ...msg, streaming: false } : msg));
          } else if (line.startsWith('event: error')) {
            setMessages(m => m.map((msg, i) =>
              i === assistantIdx ? { ...msg, content: msg.content + '\n[Error de stream]', streaming: false } : msg
            ));
          }
        }
      }
    } catch (e: any) {
      setMessages(m => m.map((msg, i) =>
        i === assistantIdx ? { ...msg, content: `Error: ${e.message}`, streaming: false } : msg
      ));
    } finally {
      setLoading(false);
      setMessages(m => m.map(msg => ({ ...msg, streaming: false })));
    }
  };

  return (
    <>
      <header className="mb-6">
        <div className="flex items-center gap-2 mb-2">
          <Link href={`/projects/agentes/${id}`} className="text-sm text-[#71BF44] hover:underline flex items-center gap-1">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            {agent?.name ?? 'Agente'}
          </Link>
        </div>
        <h2 className="text-2xl font-bold text-neutral-900 dark:text-[#e5e5e5] tracking-tight">Playground</h2>
      </header>

      {/* API key input */}
      <div className="mb-4">
        <div className="flex gap-2 items-center">
          <input
            type="password"
            placeholder="API Key del agente (Bearer token)"
            className="flex-1 bg-neutral-50 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-700 rounded-lg px-3 py-2 text-sm text-neutral-900 dark:text-white font-mono"
            value={apiKey}
            onChange={e => setApiKey(e.target.value)}
          />
          <button
            onClick={() => setMessages([])}
            className="text-sm text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-200 px-3 py-2 border border-neutral-200 dark:border-neutral-700 rounded-lg"
          >
            Limpiar
          </button>
        </div>
        {!apiKey && (
          <p className="text-xs text-amber-600 dark:text-amber-400 mt-1">
            Necesitas una API key — créala en{' '}
            <Link href={`/projects/agentes/${id}/keys`} className="underline">API Keys</Link>
          </p>
        )}
      </div>

      {/* Chat area */}
      <div className="bg-white dark:bg-[#131313] border border-neutral-200 dark:border-neutral-800 rounded-xl flex flex-col" style={{ height: '60vh' }}>
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {messages.length === 0 && (
            <div className="flex items-center justify-center h-full text-neutral-400 text-sm">
              Escribe un mensaje para comenzar
            </div>
          )}
          {messages.map((msg, i) => (
            <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              <div className={`max-w-[80%] rounded-2xl px-4 py-2.5 text-sm whitespace-pre-wrap ${
                msg.role === 'user'
                  ? 'bg-[#71BF44] text-white rounded-br-sm'
                  : 'bg-neutral-100 dark:bg-neutral-800 text-neutral-900 dark:text-white rounded-bl-sm'
              }`}>
                {msg.content}
                {msg.streaming && (
                  <span className="inline-block w-1.5 h-4 bg-current ml-0.5 animate-pulse align-middle" />
                )}
              </div>
            </div>
          ))}
          <div ref={bottomRef} />
        </div>

        {/* Input */}
        <div className="border-t border-neutral-200 dark:border-neutral-800 p-3 flex gap-2">
          <textarea
            rows={2}
            className="flex-1 bg-transparent text-sm text-neutral-900 dark:text-white resize-none focus:outline-none placeholder:text-neutral-400"
            placeholder={apiKey ? 'Escribe tu mensaje…' : 'Introduce una API key para chatear'}
            value={input}
            disabled={!apiKey || loading}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); } }}
          />
          <button
            onClick={send}
            disabled={!input.trim() || !apiKey || loading}
            className="self-end bg-[#71BF44] hover:bg-[#5ea832] disabled:opacity-40 text-white rounded-lg w-9 h-9 flex items-center justify-center transition-colors"
          >
            {loading ? (
              <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4l3-3-3-3v4a8 8 0 00-8 8h4z" />
              </svg>
            ) : (
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
              </svg>
            )}
          </button>
        </div>
      </div>
    </>
  );
}

'use client';

import { useEffect, useRef } from 'react';

export type ChatMessage = { role: 'user' | 'assistant'; content: string; streaming?: boolean };

export type PanelAgent = {
  id: string;
  name: string;
  description?: string;
  model?: string;
  enabled?: boolean;
};

export type PanelState = {
  agentId: string;
  conversationId: string;
  messages: ChatMessage[];
  loading: boolean;
  lastDurationMs?: number;
  error?: string;
};

type Props = {
  agents: PanelAgent[];
  panel: PanelState;
  onChangeAgent: (agentId: string) => void;
  onClear: () => void;
  onRemove?: () => void;
};

export default function ChatPanel({ agents, panel, onChangeAgent, onClear, onRemove }: Props) {
  const bottomRef = useRef<HTMLDivElement>(null);
  const agent = agents.find(a => a.id === panel.agentId);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [panel.messages]);

  return (
    <div className="bg-white dark:bg-[#131313] border border-neutral-200 dark:border-neutral-800 rounded-xl flex flex-col h-full min-h-0">
      {/* Header — selector + acciones */}
      <div className="border-b border-neutral-200 dark:border-neutral-800 px-4 py-3 flex items-center gap-2">
        <select
          value={panel.agentId}
          onChange={e => onChangeAgent(e.target.value)}
          className="flex-1 min-w-0 bg-neutral-50 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-700 rounded-lg px-3 py-1.5 text-sm font-medium text-neutral-900 dark:text-white focus:outline-none focus:border-[#71BF44]"
        >
          <option value="">— Selecciona un agente —</option>
          {agents.map(a => (
            <option key={a.id} value={a.id}>
              {a.name}{a.enabled === false ? ' (inactivo)' : ''}
            </option>
          ))}
        </select>
        <button
          onClick={onClear}
          title="Limpiar este panel (reinicia el hilo)"
          className="text-xs text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200 px-2 py-1.5 border border-neutral-200 dark:border-neutral-700 rounded-lg flex-shrink-0"
        >
          Limpiar
        </button>
        {onRemove && (
          <button
            onClick={onRemove}
            title="Quitar este panel"
            className="text-neutral-400 hover:text-red-500 px-2 py-1.5 border border-neutral-200 dark:border-neutral-700 rounded-lg flex-shrink-0"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        )}
      </div>

      {/* Sub-header — modelo + latencia */}
      {agent && (
        <div className="px-4 py-2 border-b border-neutral-100 dark:border-neutral-900 text-xs text-neutral-500 dark:text-neutral-400 flex items-center gap-3 flex-wrap">
          <span className="flex items-center gap-1">
            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 3H5a2 2 0 00-2 2v4m6-6h10a2 2 0 012 2v4M9 3v18m0 0h10a2 2 0 002-2V9M9 21H5a2 2 0 01-2-2V9m0 0h18" />
            </svg>
            {agent.model ?? '—'}
          </span>
          {typeof panel.lastDurationMs === 'number' && (
            <span>· {(panel.lastDurationMs / 1000).toFixed(2)}s</span>
          )}
          {panel.error && (
            <span className="text-red-500 truncate">· {panel.error}</span>
          )}
        </div>
      )}

      {/* Mensajes */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {panel.messages.length === 0 && (
          <div className="flex items-center justify-center h-full text-neutral-400 text-sm text-center px-4">
            {agent ? 'Escribe un mensaje abajo para comenzar' : 'Selecciona un agente para empezar'}
          </div>
        )}
        {panel.messages.map((msg, i) => (
          <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div className={`max-w-[85%] rounded-2xl px-4 py-2.5 text-sm whitespace-pre-wrap break-words ${
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
    </div>
  );
}

'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import AgentesNav from '@/components/agentes/AgentesNav';
import ChatPanel, { PanelAgent, PanelState } from '@/components/agentes/ChatPanel';

function uuid(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID();
  return 'cmp-' + Math.random().toString(36).slice(2) + Date.now().toString(36);
}

function makePanel(agentId = ''): PanelState {
  return { agentId, conversationId: uuid(), messages: [], loading: false };
}

// Agente "virtual" — apunta al webhook viejo de SARA (n8n).
// El frontend lo trata como cualquier otro agente; el fetch se desvía en
// streamOnePanel cuando el id empieza con `legacy:`.
const LEGACY_SARA_ID = 'legacy:sara-webhook-v5';
const LEGACY_SARA_AGENT: PanelAgent = {
  id: LEGACY_SARA_ID,
  name: 'SARA Legacy — webhook n8n (anterior)',
  description: 'Versión anterior de SARA vía sara.mysatcomla.com/webhook/sara-chat',
  model: 'n8n webhook · legacy',
  enabled: true,
};

function endpointForAgent(agentId: string): string {
  if (agentId === LEGACY_SARA_ID) return '/api/agentes/legacy/sara-chat';
  return `/api/agentes/v1/agents/${agentId}/invoke/stream`;
}

export default function CompararPage() {
  const [agents, setAgents] = useState<PanelAgent[]>([]);
  const [panels, setPanels] = useState<PanelState[]>([makePanel()]);
  const [input, setInput] = useState('');

  useEffect(() => {
    fetch('/api/agentes/v1/agents')
      .then(r => r.json())
      .then((arr: PanelAgent[]) => {
        const list = Array.isArray(arr) ? arr : [];
        // Anexamos el agente legacy al final para que aparezca como opción
        // adicional sin desplazar al agente por defecto del selector.
        const combined = [...list, LEGACY_SARA_AGENT];
        setAgents(combined);
        setPanels(prev => prev.map(p => {
          if (p.agentId) return p;
          const first = list.find(a => a.enabled !== false) ?? LEGACY_SARA_AGENT;
          return { ...p, agentId: first.id };
        }));
      })
      .catch(() => {
        // Aún sin conexión al backend mostramos el agente legacy.
        setAgents([LEGACY_SARA_AGENT]);
        setPanels(prev => prev.map(p => (p.agentId ? p : { ...p, agentId: LEGACY_SARA_ID })));
      });
  }, []);

  const setPanelAt = (i: number, updater: (p: PanelState) => PanelState) => {
    setPanels(prev => prev.map((p, idx) => idx === i ? updater(p) : p));
  };

  const addPanel = () => {
    if (panels.length >= 2) return;
    const used = new Set(panels.map(p => p.agentId));
    const suggested = agents.find(a => !used.has(a.id) && a.enabled !== false);
    setPanels([...panels, makePanel(suggested?.id ?? '')]);
  };

  const removePanel = (i: number) => {
    if (panels.length <= 1) return;
    setPanels(prev => prev.filter((_, idx) => idx !== i));
  };

  const clearPanel = (i: number) => {
    setPanelAt(i, p => ({
      ...p,
      conversationId: uuid(),
      messages: [],
      lastDurationMs: undefined,
      error: undefined,
    }));
  };

  const changeAgent = (i: number, agentId: string) => {
    // Cambiar de agente reinicia el hilo (el historial conversacional vive por agent_id + conversation_id).
    setPanelAt(i, p => ({
      ...p,
      agentId,
      conversationId: uuid(),
      messages: [],
      lastDurationMs: undefined,
      error: undefined,
    }));
  };

  const streamOnePanel = async (i: number, agentId: string, conversationId: string, prompt: string, t0: number) => {
    // assistantIdx = el índice del placeholder assistant que ya se agregó en setPanels al iniciar send()
    // Lo derivamos dinámicamente leyendo el último mensaje del panel cada vez.
    try {
      const res = await fetch(endpointForAgent(agentId), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        // Sin Authorization → el proxy server-side inyecta AGENTES_API_TOKEN (admin bypass).
        // El endpoint legacy ignora Authorization y reenvía al webhook n8n con FormData.
        body: JSON.stringify({ prompt, conversation_id: conversationId }),
      });

      if (!res.ok) {
        const errText = await res.text().catch(() => '');
        setPanelAt(i, p => ({
          ...p,
          loading: false,
          error: `Error ${res.status}`,
          messages: p.messages.map((m, idx) =>
            idx === p.messages.length - 1 && m.role === 'assistant'
              ? { ...m, content: `Error ${res.status}: ${errText.slice(0, 200)}`, streaming: false }
              : m,
          ),
        }));
        return;
      }

      const reader = res.body?.getReader();
      const decoder = new TextDecoder();
      if (!reader) return;

      let buffer = '';
      let currentEvent: string | null = null;
      let currentData: string[] = [];

      const appendToAssistant = (text: string) => {
        setPanelAt(i, p => ({
          ...p,
          messages: p.messages.map((m, idx) =>
            idx === p.messages.length - 1 && m.role === 'assistant'
              ? { ...m, content: m.content + text }
              : m,
          ),
        }));
      };

      const replaceAssistant = (text: string) => {
        setPanelAt(i, p => ({
          ...p,
          messages: p.messages.map((m, idx) =>
            idx === p.messages.length - 1 && m.role === 'assistant'
              ? { ...m, content: text }
              : m,
          ),
        }));
      };

      const finishAssistant = (durationMs: number) => {
        setPanelAt(i, p => ({
          ...p,
          loading: false,
          lastDurationMs: durationMs,
          messages: p.messages.map((m, idx) =>
            idx === p.messages.length - 1 && m.role === 'assistant'
              ? { ...m, streaming: false }
              : m,
          ),
        }));
      };

      const flushEvent = () => {
        if (currentData.length === 0 && !currentEvent) return;
        const data = currentData.join('\n');
        if (currentEvent === 'done') {
          // El backend envía duration_ms, pero medir desde el cliente es suficiente.
          finishAssistant(Math.round(performance.now() - t0));
        } else if (currentEvent === 'error') {
          setPanelAt(i, p => ({
            ...p,
            loading: false,
            error: data.slice(0, 200),
            messages: p.messages.map((m, idx) =>
              idx === p.messages.length - 1 && m.role === 'assistant'
                ? { ...m, content: m.content + `\n[Error: ${data}]`, streaming: false }
                : m,
            ),
          }));
        } else if (currentEvent === 'replace') {
          // Post-procesamiento del backend (URLs truncadas, links rotos): reemplaza el texto final
          replaceAssistant(data);
        } else {
          // Chunk de streaming normal
          appendToAssistant(data);
        }
        currentEvent = null;
        currentData = [];
      };

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        let nlIdx: number;
        while ((nlIdx = buffer.indexOf('\n')) >= 0) {
          const line = buffer.slice(0, nlIdx);
          buffer = buffer.slice(nlIdx + 1);
          if (line === '') {
            flushEvent();
          } else if (line.startsWith('event: ')) {
            currentEvent = line.slice(7).trim();
          } else if (line.startsWith('data: ')) {
            currentData.push(line.slice(6));
          }
        }
      }
      flushEvent();

      // Por si el stream cerró sin enviar event: done explícito
      setPanelAt(i, p => p.loading
        ? { ...p, loading: false, messages: p.messages.map((m, idx) =>
            idx === p.messages.length - 1 && m.role === 'assistant' ? { ...m, streaming: false } : m) }
        : p,
      );
    } catch (e: any) {
      setPanelAt(i, p => ({
        ...p,
        loading: false,
        error: e?.message ?? 'Error de red',
        messages: p.messages.map((m, idx) =>
          idx === p.messages.length - 1 && m.role === 'assistant'
            ? { ...m, content: `Error: ${e?.message ?? 'red'}`, streaming: false }
            : m,
        ),
      }));
    }
  };

  const send = () => {
    const prompt = input.trim();
    if (!prompt) return;
    if (panels.some(p => !p.agentId)) return;
    setInput('');

    const t0 = performance.now();

    // Snapshot ANTES de mutar — usamos estos valores para los fetch (conversationId estable).
    const snapshot = panels.map(p => ({ agentId: p.agentId, conversationId: p.conversationId }));

    // Agregar mensaje user + placeholder assistant en todos los paneles
    setPanels(prev => prev.map(p => ({
      ...p,
      loading: true,
      error: undefined,
      messages: [
        ...p.messages,
        { role: 'user', content: prompt },
        { role: 'assistant', content: '', streaming: true },
      ],
    })));

    // Disparar streams en paralelo
    snapshot.forEach((s, i) => {
      void streamOnePanel(i, s.agentId, s.conversationId, prompt, t0);
    });
  };

  const anyLoading = panels.some(p => p.loading);
  const allReady = panels.every(p => p.agentId);
  const canSend = !!input.trim() && !anyLoading && allReady;

  return (
    <>
      <header className="mb-6">
        <div className="flex items-center gap-2 mb-2">
          <Link href="/projects" className="text-sm text-[#71BF44] hover:underline flex items-center gap-1">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            Proyectos
          </Link>
        </div>
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div>
            <h2 className="text-2xl font-bold text-neutral-900 dark:text-[#e5e5e5] tracking-tight">Agentes IA</h2>
            <p className="text-sm text-neutral-500 dark:text-[#ababab] mt-1">
              Comparador — prueba un agente o compara dos lado a lado con el mismo prompt.
            </p>
          </div>
          {panels.length < 2 && (
            <button
              onClick={addPanel}
              disabled={agents.length === 0}
              className="flex items-center gap-2 bg-[#71BF44] hover:bg-[#5ea832] disabled:opacity-50 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              Comparar con otro agente
            </button>
          )}
        </div>
      </header>

      <AgentesNav />

      {/* Paneles */}
      <div
        className={`grid gap-4 mb-4 ${panels.length === 2 ? 'grid-cols-1 md:grid-cols-2' : 'grid-cols-1'}`}
        style={{ height: '60vh' }}
      >
        {panels.map((p, i) => (
          <ChatPanel
            key={i}
            agents={agents}
            panel={p}
            onChangeAgent={(id) => changeAgent(i, id)}
            onClear={() => clearPanel(i)}
            onRemove={panels.length > 1 ? () => removePanel(i) : undefined}
          />
        ))}
      </div>

      {/* Cuadro de prompt único */}
      <div className="bg-white dark:bg-[#131313] border border-neutral-200 dark:border-neutral-800 rounded-xl p-3 flex gap-2">
        <textarea
          rows={2}
          className="flex-1 bg-transparent text-sm text-neutral-900 dark:text-white resize-none focus:outline-none placeholder:text-neutral-400"
          placeholder={
            !allReady
              ? 'Selecciona un agente para empezar'
              : panels.length === 1
                ? 'Escribe tu mensaje…'
                : 'Escribe tu mensaje (se envía a ambos paneles)…'
          }
          value={input}
          disabled={anyLoading || !allReady}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); } }}
        />
        <button
          onClick={send}
          disabled={!canSend}
          className="self-end bg-[#71BF44] hover:bg-[#5ea832] disabled:opacity-40 text-white rounded-lg w-10 h-10 flex items-center justify-center transition-colors"
        >
          {anyLoading ? (
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
    </>
  );
}

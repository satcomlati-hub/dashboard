'use client';

import { useState } from 'react';
import { buildInvokeUrl, delegateInputSchema, BUILTIN_TOOLS } from '@/lib/agentes';

/**
 * Asistente "Crear subagente en un paso".
 *
 * Fusiona el flujo que antes requería 3 pantallas distintas:
 *   1. Crear el agente hijo (con defaults seguros: builtins de archivos/shell off).
 *   2. Generar una API key del hijo.
 *   3. Crear la delegate-tool que apunta a su /invoke (Authorization embebido).
 *   4. Asignar esa tool al agente padre.
 *
 * Todo se ejecuta secuencialmente vía el proxy /api/agentes/* y se reporta el
 * progreso paso a paso. Al terminar, dispara onCreated() para que el editor
 * refresque sus listas.
 */

const MODELS = ['gemini-3.5-flash', 'gemini-3.1-pro-preview'];

// Builtins peligrosos (archivos/shell): se desactivan por defecto en subagentes.
const DANGER_BUILTINS = BUILTIN_TOOLS.filter(b => b.danger).map(b => b.name);

function slugify(s: string) {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

type Step = { label: string; status: 'pending' | 'running' | 'done' | 'error' };

export default function CrearSubagenteWizard({
  parentAgentId,
  parentAgentName,
  onClose,
  onCreated,
}: {
  parentAgentId: string;
  parentAgentName?: string;
  onClose: () => void;
  onCreated: () => void;
}) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [identity, setIdentity] = useState('');
  const [model, setModel] = useState('gemini-3.5-flash');
  const [running, setRunning] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState(false);
  const [steps, setSteps] = useState<Step[]>([]);

  const setStep = (i: number, status: Step['status']) =>
    setSteps(s => s.map((st, idx) => (idx === i ? { ...st, status } : st)));

  const run = async () => {
    if (!name.trim()) { setError('El nombre del subagente es obligatorio.'); return; }
    setError('');
    setRunning(true);

    const slug = slugify(name);
    const initialSteps: Step[] = [
      { label: 'Crear el subagente', status: 'pending' },
      { label: 'Generar su API key', status: 'pending' },
      { label: 'Crear la delegación', status: 'pending' },
      { label: `Asignarla a ${parentAgentName ?? 'el agente padre'}`, status: 'pending' },
    ];
    setSteps(initialSteps);

    try {
      // ── 1. Crear el subagente con defaults seguros ──
      setStep(0, 'running');
      const agentRes = await fetch('/api/agentes/v1/agents', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name.trim(),
          slug,
          description: description.trim(),
          identity: identity.trim(),
          model,
          enabled: true,
          system_sections: [{ title: 'user_system_instructions', content: '' }],
          capabilities: {
            max_steps: 6,
            allow_tools: true,
            allow_skills: true,
            disabled_tools: DANGER_BUILTINS,
          },
          limits: {},
        }),
      });
      if (!agentRes.ok) throw new Error('No se pudo crear el subagente: ' + (await agentRes.text()));
      const subagent = await agentRes.json();
      setStep(0, 'done');

      // ── 2. Generar API key del subagente ──
      setStep(1, 'running');
      const keyRes = await fetch('/api/agentes/v1/keys', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ agent_id: subagent.id, name: `delegate: ${slug}` }),
      });
      if (!keyRes.ok) throw new Error('No se pudo generar la API key: ' + (await keyRes.text()));
      const key = await keyRes.json();
      setStep(1, 'done');

      // ── 3. Crear la delegate-tool ──
      setStep(2, 'running');
      const toolName = `consultar_${slug || 'subagente'}`;
      const toolRes = await fetch('/api/agentes/v1/http-tools', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: toolName,
          slug: toolName,
          description:
            description.trim() ||
            `Delega en el subagente "${name.trim()}" para responder. Pasa la pregunta del usuario tal cual en prompt.`,
          http_method: 'POST',
          url: buildInvokeUrl(subagent.id),
          headers: {
            Authorization: `Bearer ${key.token}`,
            'Content-Type': 'application/json',
          },
          input_schema: delegateInputSchema(),
          enabled: true,
        }),
      });
      if (!toolRes.ok) throw new Error('No se pudo crear la delegación: ' + (await toolRes.text()));
      const tool = await toolRes.json();
      setStep(2, 'done');

      // ── 4. Asignar la delegación al agente padre ──
      setStep(3, 'running');
      const assignRes = await fetch(
        `/api/agentes/v1/agents/${parentAgentId}/http-tools/${tool.id}`,
        { method: 'POST' },
      );
      if (!assignRes.ok) throw new Error('No se pudo asignar la delegación al padre: ' + (await assignRes.text()));
      setStep(3, 'done');

      setDone(true);
      onCreated();
    } catch (e) {
      setSteps(s => s.map(st => (st.status === 'running' ? { ...st, status: 'error' } : st)));
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setRunning(false);
    }
  };

  const stepIcon = (status: Step['status']) => {
    if (status === 'done') return <span className="text-[#71BF44]">✓</span>;
    if (status === 'running') return <span className="text-[#71BF44] animate-pulse">●</span>;
    if (status === 'error') return <span className="text-red-500">✕</span>;
    return <span className="text-neutral-300 dark:text-neutral-600">○</span>;
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div className="bg-white dark:bg-[#131313] border border-neutral-200 dark:border-neutral-800 rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between px-6 py-4 border-b border-neutral-200 dark:border-neutral-800">
          <h3 className="font-semibold text-neutral-900 dark:text-white">Crear subagente</h3>
          <button onClick={onClose} className="text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-200">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="overflow-y-auto flex-1 px-6 py-4 space-y-5">
          {!done ? (
            <>
              <p className="text-xs text-neutral-500 dark:text-neutral-400">
                Crea un agente especializado y lo conecta como subagente de{' '}
                <strong>{parentAgentName ?? 'este agente'}</strong> en un solo paso. Las tools de
                archivos/shell quedan desactivadas por defecto (recomendado en subagentes).
              </p>

              <div>
                <label className="block text-xs text-neutral-500 mb-1">Nombre del subagente *</label>
                <input
                  className="w-full bg-neutral-50 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-700 rounded-lg px-3 py-2 text-sm text-neutral-900 dark:text-white"
                  value={name}
                  onChange={e => setName(e.target.value)}
                  placeholder="Consultor Zoho Projects"
                  disabled={running}
                />
                {name && (
                  <p className="text-[11px] text-neutral-400 mt-1">
                    El padre lo invocará con la tool <code className="font-mono">consultar_{slugify(name)}</code>
                  </p>
                )}
              </div>

              <div>
                <label className="block text-xs text-neutral-500 mb-1">
                  ¿Cuándo debe usarlo el padre?
                  <span className="ml-1 text-neutral-400">(descripción de la delegación)</span>
                </label>
                <textarea
                  rows={2}
                  className="w-full bg-neutral-50 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-700 rounded-lg px-3 py-2 text-sm text-neutral-900 dark:text-white resize-none"
                  value={description}
                  onChange={e => setDescription(e.target.value)}
                  placeholder="Cuando el usuario pregunte por proyectos, tareas o hitos en Zoho Projects."
                  disabled={running}
                />
              </div>

              <div>
                <label className="block text-xs text-neutral-500 mb-1">
                  Identidad del subagente
                  <span className="ml-1 text-neutral-400">(system prompt — opcional)</span>
                </label>
                <textarea
                  rows={2}
                  className="w-full bg-neutral-50 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-700 rounded-lg px-3 py-2 text-sm text-neutral-900 dark:text-white resize-none"
                  value={identity}
                  onChange={e => setIdentity(e.target.value)}
                  placeholder="Eres un subagente especializado en consultar Zoho Projects (solo lectura)…"
                  disabled={running}
                />
              </div>

              <div>
                <label className="block text-xs text-neutral-500 mb-1">Modelo</label>
                <select
                  className="w-full bg-neutral-50 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-700 rounded-lg px-3 py-2 text-sm text-neutral-900 dark:text-white"
                  value={model}
                  onChange={e => setModel(e.target.value)}
                  disabled={running}
                >
                  {MODELS.map(m => <option key={m} value={m}>{m}</option>)}
                </select>
              </div>

              {steps.length > 0 && (
                <div className="rounded-lg border border-neutral-200 dark:border-neutral-700 p-3 space-y-1.5">
                  {steps.map((st, i) => (
                    <div key={i} className="flex items-center gap-2 text-sm">
                      <span className="w-4 text-center">{stepIcon(st.status)}</span>
                      <span className={st.status === 'error' ? 'text-red-500' : 'text-neutral-600 dark:text-neutral-300'}>
                        {st.label}
                      </span>
                    </div>
                  ))}
                </div>
              )}

              {error && (
                <p className="text-sm text-red-500 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg px-4 py-2">
                  {error}
                </p>
              )}

              <p className="text-[11px] text-neutral-400">
                Después podrás afinar el subagente (skills, MCP, límites) entrando a su ficha.
              </p>
            </>
          ) : (
            <div className="text-center py-6">
              <div className="w-14 h-14 rounded-full bg-[#71BF44]/15 flex items-center justify-center mx-auto mb-3 text-2xl">
                ✓
              </div>
              <p className="text-sm font-medium text-neutral-900 dark:text-white">Subagente creado y conectado</p>
              <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-1">
                <strong>{name}</strong> ya está disponible para {parentAgentName ?? 'este agente'}.
              </p>
            </div>
          )}
        </div>

        <div className="flex justify-end gap-3 px-6 py-4 border-t border-neutral-200 dark:border-neutral-800">
          {!done ? (
            <>
              <button
                onClick={onClose}
                disabled={running}
                className="text-sm border border-neutral-300 dark:border-neutral-700 text-neutral-600 dark:text-neutral-300 px-4 py-2 rounded-lg hover:bg-neutral-50 dark:hover:bg-neutral-800 transition-colors disabled:opacity-50"
              >
                Cancelar
              </button>
              <button
                onClick={run}
                disabled={running}
                className="bg-[#71BF44] hover:bg-[#5ea832] disabled:opacity-50 text-white text-sm font-medium px-5 py-2 rounded-lg transition-colors"
              >
                {running ? 'Creando…' : 'Crear y conectar'}
              </button>
            </>
          ) : (
            <button
              onClick={onClose}
              className="bg-[#71BF44] hover:bg-[#5ea832] text-white text-sm font-medium px-5 py-2 rounded-lg transition-colors"
            >
              Listo
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

'use client';

import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import AgentesNav from '@/components/agentes/AgentesNav';

const MODELS = ['gemini-3.5-flash', 'gemini-3.1-pro-preview', 'gemini-3.1-flash-image-preview'];
const THINKING_LEVELS = ['minimal', 'low', 'medium', 'high'];

type Agent = {
  id: string; name: string; slug: string; description: string; identity: string;
  system_sections: { title: string; content: string }[];
  model: string; thinking_level: string | null; enabled: boolean;
};

export default function AgentEditorPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const isNew = id === 'new';

  const [agent, setAgent] = useState<Partial<Agent>>({
    name: '', slug: '', description: '', identity: '',
    system_sections: [{ title: 'user_system_instructions', content: '' }],
    model: 'gemini-3.5-flash', thinking_level: null, enabled: true,
  });
  const [skills, setSkills] = useState<any[]>([]);
  const [allSkills, setAllSkills] = useState<any[]>([]);
  const [mcpServers, setMcpServers] = useState<any[]>([]);
  const [allMcp, setAllMcp] = useState<any[]>([]);
  const [httpTools, setHttpTools] = useState<any[]>([]);
  const [allHttpTools, setAllHttpTools] = useState<any[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!isNew) {
      fetch(`/api/agentes/v1/agents/${id}`).then(r => r.json()).then(setAgent);
      fetch(`/api/agentes/v1/agents/${id}/skills`).then(r => r.json()).then(setSkills);
      fetch(`/api/agentes/v1/agents/${id}/mcp-servers`).then(r => r.json()).then(setMcpServers);
      fetch(`/api/agentes/v1/agents/${id}/http-tools`).then(r => r.json()).then(setHttpTools);
    }
    fetch('/api/agentes/v1/skills').then(r => r.json()).then(setAllSkills);
    fetch('/api/agentes/v1/mcp-servers').then(r => r.json()).then(setAllMcp);
    fetch('/api/agentes/v1/http-tools').then(r => r.json()).then(setAllHttpTools);
  }, [id, isNew]);

  const save = async () => {
    setSaving(true); setError('');
    try {
      const url = isNew ? '/api/agentes/v1/agents' : `/api/agentes/v1/agents/${id}`;
      const method = isNew ? 'POST' : 'PATCH';
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(agent),
      });
      if (!res.ok) throw new Error(await res.text());
      const saved = await res.json();
      if (isNew) router.push(`/projects/agentes/${saved.id}`);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  };

  const toggleSkill = async (skillId: string, assigned: boolean) => {
    if (assigned) {
      await fetch(`/api/agentes/v1/agents/${id}/skills/${skillId}`, { method: 'DELETE' });
      setSkills(s => s.filter((x: any) => x.id !== skillId));
    } else {
      await fetch(`/api/agentes/v1/agents/${id}/skills/${skillId}`, { method: 'POST' });
      const sk = allSkills.find((x: any) => x.id === skillId);
      if (sk) setSkills(s => [...s, sk]);
    }
  };

  const toggleMcp = async (serverId: string, assigned: boolean) => {
    if (assigned) {
      await fetch(`/api/agentes/v1/agents/${id}/mcp-servers/${serverId}`, { method: 'DELETE' });
      setMcpServers(s => s.filter((x: any) => x.id !== serverId));
    } else {
      await fetch(`/api/agentes/v1/agents/${id}/mcp-servers/${serverId}`, { method: 'POST' });
      const m = allMcp.find((x: any) => x.id === serverId);
      if (m) setMcpServers(s => [...s, m]);
    }
  };

  const toggleHttpTool = async (toolId: string, assigned: boolean) => {
    if (assigned) {
      await fetch(`/api/agentes/v1/agents/${id}/http-tools/${toolId}`, { method: 'DELETE' });
      setHttpTools(s => s.filter((x: any) => x.id !== toolId));
    } else {
      await fetch(`/api/agentes/v1/agents/${id}/http-tools/${toolId}`, { method: 'POST' });
      const t = allHttpTools.find((x: any) => x.id === toolId);
      if (t) setHttpTools(s => [...s, t]);
    }
  };

  const updateSection = (idx: number, field: 'title' | 'content', value: string) => {
    setAgent(a => ({
      ...a,
      system_sections: (a.system_sections ?? []).map((s, i) => i === idx ? { ...s, [field]: value } : s),
    }));
  };

  return (
    <>
      <header className="mb-8">
        <div className="flex items-center gap-2 mb-2">
          <Link href="/projects/agentes" className="text-sm text-[#71BF44] hover:underline flex items-center gap-1">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            Agentes
          </Link>
        </div>
        <div className="flex items-center justify-between">
          <h2 className="text-2xl font-bold text-neutral-900 dark:text-[#e5e5e5] tracking-tight">
            {isNew ? 'Nuevo agente' : (agent.name ?? '…')}
          </h2>
          {!isNew && (
            <div className="flex gap-2">
              <Link
                href={`/projects/agentes/${id}/playground`}
                className="text-sm border border-[#71BF44] text-[#71BF44] hover:bg-[#71BF44]/10 px-3 py-1.5 rounded-lg transition-colors"
              >
                Playground
              </Link>
              <Link
                href={`/projects/agentes/${id}/runs`}
                className="text-sm border border-neutral-300 dark:border-neutral-700 text-neutral-600 dark:text-neutral-300 hover:bg-neutral-50 dark:hover:bg-neutral-800 px-3 py-1.5 rounded-lg transition-colors"
              >
                Historial
              </Link>
              <Link
                href={`/projects/agentes/${id}/keys`}
                className="text-sm border border-neutral-300 dark:border-neutral-700 text-neutral-600 dark:text-neutral-300 hover:bg-neutral-50 dark:hover:bg-neutral-800 px-3 py-1.5 rounded-lg transition-colors"
              >
                API Keys
              </Link>
            </div>
          )}
        </div>
      </header>

      <AgentesNav />

      <div className="space-y-6 max-w-3xl">
        {/* Básicos */}
        <section className="bg-white dark:bg-[#131313] border border-neutral-200 dark:border-neutral-800 rounded-xl p-6 space-y-4">
          <h3 className="font-semibold text-neutral-800 dark:text-neutral-200">Información básica</h3>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs text-neutral-500 mb-1">Nombre</label>
              <input
                className="w-full bg-neutral-50 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-700 rounded-lg px-3 py-2 text-sm text-neutral-900 dark:text-white"
                value={agent.name ?? ''}
                onChange={e => setAgent(a => ({ ...a, name: e.target.value }))}
              />
            </div>
            <div>
              <label className="block text-xs text-neutral-500 mb-1">Slug</label>
              <input
                className="w-full bg-neutral-50 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-700 rounded-lg px-3 py-2 text-sm text-neutral-900 dark:text-white"
                value={agent.slug ?? ''}
                onChange={e => setAgent(a => ({ ...a, slug: e.target.value }))}
              />
            </div>
          </div>
          <div>
            <label className="block text-xs text-neutral-500 mb-1">Descripción</label>
            <input
              className="w-full bg-neutral-50 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-700 rounded-lg px-3 py-2 text-sm text-neutral-900 dark:text-white"
              value={agent.description ?? ''}
              onChange={e => setAgent(a => ({ ...a, description: e.target.value }))}
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs text-neutral-500 mb-1">Modelo</label>
              <select
                className="w-full bg-neutral-50 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-700 rounded-lg px-3 py-2 text-sm text-neutral-900 dark:text-white"
                value={agent.model ?? 'gemini-3.5-flash'}
                onChange={e => setAgent(a => ({ ...a, model: e.target.value }))}
              >
                {MODELS.map(m => <option key={m} value={m}>{m}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs text-neutral-500 mb-1">Thinking level</label>
              <select
                className="w-full bg-neutral-50 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-700 rounded-lg px-3 py-2 text-sm text-neutral-900 dark:text-white"
                value={agent.thinking_level ?? ''}
                onChange={e => setAgent(a => ({ ...a, thinking_level: e.target.value || null }))}
              >
                <option value="">Por defecto</option>
                {THINKING_LEVELS.map(l => <option key={l} value={l}>{l}</option>)}
              </select>
            </div>
          </div>
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              className="w-4 h-4 accent-[#71BF44]"
              checked={agent.enabled ?? true}
              onChange={e => setAgent(a => ({ ...a, enabled: e.target.checked }))}
            />
            <span className="text-sm text-neutral-700 dark:text-neutral-300">Agente activo</span>
          </label>
        </section>

        {/* System prompt */}
        <section className="bg-white dark:bg-[#131313] border border-neutral-200 dark:border-neutral-800 rounded-xl p-6 space-y-4">
          <h3 className="font-semibold text-neutral-800 dark:text-neutral-200">System prompt</h3>
          <div>
            <label className="block text-xs text-neutral-500 mb-1">Identidad del agente</label>
            <textarea
              rows={3}
              className="w-full bg-neutral-50 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-700 rounded-lg px-3 py-2 text-sm text-neutral-900 dark:text-white resize-none"
              placeholder="Eres un agente de soporte técnico especializado en…"
              value={agent.identity ?? ''}
              onChange={e => setAgent(a => ({ ...a, identity: e.target.value }))}
            />
          </div>
          {(agent.system_sections ?? []).map((sec, i) => (
            <div key={i}>
              <label className="block text-xs text-neutral-500 mb-1">Sección {i + 1}</label>
              <textarea
                rows={4}
                className="w-full bg-neutral-50 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-700 rounded-lg px-3 py-2 text-sm text-neutral-900 dark:text-white resize-none"
                placeholder="Instrucciones adicionales…"
                value={sec.content}
                onChange={e => updateSection(i, 'content', e.target.value)}
              />
            </div>
          ))}
          <button
            type="button"
            onClick={() => setAgent(a => ({
              ...a,
              system_sections: [...(a.system_sections ?? []), { title: 'user_system_instructions', content: '' }],
            }))}
            className="text-xs text-[#71BF44] hover:underline"
          >
            + Añadir sección
          </button>
        </section>

        {/* Skills */}
        {!isNew && (
          <section className="bg-white dark:bg-[#131313] border border-neutral-200 dark:border-neutral-800 rounded-xl p-6 space-y-3">
            <h3 className="font-semibold text-neutral-800 dark:text-neutral-200">Skills</h3>
            {allSkills.length === 0 ? (
              <p className="text-sm text-neutral-400">No hay skills creadas aún.</p>
            ) : (
              <div className="space-y-2">
                {allSkills.map((sk: any) => {
                  const assigned = skills.some((s: any) => s.id === sk.id);
                  return (
                    <label key={sk.id} className="flex items-center gap-3 cursor-pointer">
                      <input
                        type="checkbox"
                        className="w-4 h-4 accent-[#71BF44]"
                        checked={assigned}
                        onChange={() => toggleSkill(sk.id, assigned)}
                      />
                      <div>
                        <span className="text-sm font-medium text-neutral-800 dark:text-neutral-200">{sk.name}</span>
                        {sk.description && <span className="text-xs text-neutral-400 ml-2">{sk.description}</span>}
                      </div>
                    </label>
                  );
                })}
              </div>
            )}
          </section>
        )}

        {/* MCP Servers */}
        {!isNew && (
          <section className="bg-white dark:bg-[#131313] border border-neutral-200 dark:border-neutral-800 rounded-xl p-6 space-y-3">
            <h3 className="font-semibold text-neutral-800 dark:text-neutral-200">Servidores MCP</h3>
            {allMcp.length === 0 ? (
              <p className="text-sm text-neutral-400">No hay servidores MCP configurados.</p>
            ) : (
              <div className="space-y-2">
                {allMcp.map((m: any) => {
                  const assigned = mcpServers.some((s: any) => s.id === m.id);
                  return (
                    <label key={m.id} className="flex items-center gap-3 cursor-pointer">
                      <input
                        type="checkbox"
                        className="w-4 h-4 accent-[#71BF44]"
                        checked={assigned}
                        onChange={() => toggleMcp(m.id, assigned)}
                      />
                      <div>
                        <span className="text-sm font-medium text-neutral-800 dark:text-neutral-200">{m.name}</span>
                        <span className="text-xs text-neutral-400 ml-2">[{m.transport}]</span>
                      </div>
                    </label>
                  );
                })}
              </div>
            )}
          </section>
        )}

        {/* Herramientas HTTP */}
        {!isNew && (
          <section className="bg-white dark:bg-[#131313] border border-neutral-200 dark:border-neutral-800 rounded-xl p-6 space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-neutral-800 dark:text-neutral-200">Herramientas</h3>
              <Link
                href="/projects/agentes/herramientas"
                className="text-xs text-[#71BF44] hover:underline"
              >
                Gestionar →
              </Link>
            </div>
            {allHttpTools.length === 0 ? (
              <p className="text-sm text-neutral-400">No hay herramientas HTTP creadas aún.</p>
            ) : (
              <div className="space-y-2">
                {allHttpTools.map((t: any) => {
                  const assigned = httpTools.some((x: any) => x.id === t.id);
                  const methodColor: Record<string, string> = {
                    GET: 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400',
                    POST: 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400',
                    PUT: 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400',
                    PATCH: 'bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-400',
                    DELETE: 'bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400',
                  };
                  return (
                    <label key={t.id} className="flex items-center gap-3 cursor-pointer">
                      <input
                        type="checkbox"
                        className="w-4 h-4 accent-[#71BF44]"
                        checked={assigned}
                        onChange={() => toggleHttpTool(t.id, assigned)}
                      />
                      <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${methodColor[t.http_method] ?? 'bg-neutral-100 dark:bg-neutral-800 text-neutral-600'}`}>
                        {t.http_method}
                      </span>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium text-neutral-800 dark:text-neutral-200">{t.name}</span>
                          {!t.enabled && (
                            <span className="text-[10px] px-1.5 py-0.5 rounded bg-neutral-100 dark:bg-neutral-800 text-neutral-500">inactiva</span>
                          )}
                        </div>
                        {t.description && (
                          <span className="text-xs text-neutral-400 block truncate">{t.description}</span>
                        )}
                      </div>
                    </label>
                  );
                })}
              </div>
            )}
          </section>
        )}

        {error && (
          <p className="text-sm text-red-500 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg px-4 py-2">
            {error}
          </p>
        )}

        <div className="flex gap-3">
          <button
            onClick={save}
            disabled={saving}
            className="bg-[#71BF44] hover:bg-[#5ea832] disabled:opacity-50 text-white text-sm font-medium px-5 py-2 rounded-lg transition-colors"
          >
            {saving ? 'Guardando…' : (isNew ? 'Crear agente' : 'Guardar cambios')}
          </button>
          <Link
            href="/projects/agentes"
            className="text-sm border border-neutral-300 dark:border-neutral-700 text-neutral-600 dark:text-neutral-300 hover:bg-neutral-50 dark:hover:bg-neutral-800 px-5 py-2 rounded-lg transition-colors"
          >
            Cancelar
          </Link>
        </div>
      </div>
    </>
  );
}

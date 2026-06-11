'use client';

import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import AgentesNav from '@/components/agentes/AgentesNav';
import CrearSubagenteWizard from '@/components/agentes/CrearSubagenteWizard';
import { BUILTIN_TOOLS, buildInvokeUrl, delegateInputSchema, delegateTargetId, isDelegateTool } from '@/lib/agentes';

// Modelos siempre presentes en el dropdown aunque no estén en ai_pricing
// (p. ej. el de imágenes, que no se tarifa por tokens de texto).
const FALLBACK_MODELS = ['gemini-3.5-flash', 'gemini-3.1-pro-preview', 'gemini-3.1-flash-image-preview'];
const THINKING_LEVELS = ['minimal', 'low', 'medium', 'high'];
const BUCKETS = [
  { key: 'hour', label: 'Por hora' },
  { key: 'day', label: 'Por día' },
  { key: 'week', label: 'Por semana' },
] as const;

type Pricing = { provider: string; model: string; inputPer1M: number; outputPer1M: number; cachedPer1M: number };
type LimitCfg = { usd?: number; action?: 'notify' | 'stop' };
type Limits = { hour?: LimitCfg; day?: LimitCfg; week?: LimitCfg; [k: string]: LimitCfg | undefined };

type Capabilities = {
  max_steps?: number;
  allow_tools?: boolean;
  allow_skills?: boolean;
  disabled_tools?: string[];
  [k: string]: unknown;
};

type Agent = {
  id: string; name: string; slug: string; description: string; identity: string;
  system_sections: { title: string; content: string }[];
  model: string; thinking_level: string | null; enabled: boolean;
  capabilities: Capabilities;
  limits: Limits;
};

export default function AgentEditorPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const isNew = id === 'new';

  const [agent, setAgent] = useState<Partial<Agent>>({
    name: '', slug: '', description: '', identity: '',
    system_sections: [{ title: 'user_system_instructions', content: '' }],
    model: 'gemini-3.5-flash', thinking_level: null, enabled: true,
    capabilities: { max_steps: 6, allow_tools: true, allow_skills: true, disabled_tools: [] },
    limits: {},
  });
  const [pricing, setPricing] = useState<Pricing[]>([]);
  const [allAgents, setAllAgents] = useState<any[]>([]);
  const [skills, setSkills] = useState<any[]>([]);
  const [allSkills, setAllSkills] = useState<any[]>([]);
  const [mcpServers, setMcpServers] = useState<any[]>([]);
  const [allMcp, setAllMcp] = useState<any[]>([]);
  const [httpTools, setHttpTools] = useState<any[]>([]);
  const [allHttpTools, setAllHttpTools] = useState<any[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [showSubagentWizard, setShowSubagentWizard] = useState(false);
  const [tab, setTab] = useState<'general' | 'prompt' | 'capacidades' | 'conexiones' | 'subagentes'>('general');

  // Recarga las listas relacionadas con delegaciones (tras crear un subagente).
  const reloadDelegations = () => {
    if (!isNew) {
      fetch(`/api/agentes/v1/agents/${id}/http-tools`).then(r => r.json()).then(setHttpTools).catch(() => {});
    }
    fetch('/api/agentes/v1/http-tools').then(r => r.json()).then(setAllHttpTools).catch(() => {});
    fetch('/api/agentes/v1/agents').then(r => r.json()).then(d => Array.isArray(d) && setAllAgents(d)).catch(() => {});
  };

  useEffect(() => {
    if (!isNew) {
      fetch(`/api/agentes/v1/agents/${id}`).then(r => r.json()).then(setAgent);
      fetch(`/api/skills?agentId=${id}`).then(r => r.json()).then(setSkills);
      fetch(`/api/agentes/v1/agents/${id}/mcp-servers`).then(r => r.json()).then(setMcpServers);
      fetch(`/api/agentes/v1/agents/${id}/http-tools`).then(r => r.json()).then(setHttpTools);
    }
    fetch('/api/skills').then(r => r.json()).then(setAllSkills);
    fetch('/api/agentes/v1/mcp-servers').then(r => r.json()).then(setAllMcp);
    fetch('/api/agentes/v1/http-tools').then(r => r.json()).then(setAllHttpTools);
    fetch('/api/agentes/v1/agents').then(r => r.json()).then(d => Array.isArray(d) && setAllAgents(d)).catch(() => {});
    fetch('/api/pricing').then(r => r.json()).then(d => Array.isArray(d) && setPricing(d)).catch(() => {});
  }, [id, isNew]);

  const caps: Capabilities = agent.capabilities ?? {};
  const disabledTools: string[] = Array.isArray(caps.disabled_tools) ? caps.disabled_tools : [];
  const setCap = (patch: Partial<Capabilities>) =>
    setAgent(a => ({ ...a, capabilities: { ...(a.capabilities ?? {}), ...patch } }));
  const toggleBuiltin = (name: string, disabled: boolean) =>
    setCap({ disabled_tools: disabled ? disabledTools.filter(t => t !== name) : [...disabledTools, name] });

  // ── Modelos + precios ──
  const priceByModel = new Map(pricing.map(p => [p.model, p]));
  const modelOptions = (() => {
    const set = new Set<string>(pricing.map(p => p.model));
    FALLBACK_MODELS.forEach(m => set.add(m));
    if (agent.model) set.add(agent.model);
    return [...set].sort();
  })();
  const fmtPrice = (m: string) => {
    const p = priceByModel.get(m);
    return p ? ` · in $${p.inputPer1M}/out $${p.outputPer1M} (1M)` : '';
  };
  const selectedPrice = priceByModel.get(agent.model ?? '');

  // ── Límites de uso (costo USD por ventana) ──
  const limits: Limits = (agent.limits ?? {}) as Limits;
  const setLimit = (bucket: string, patch: Partial<LimitCfg>) =>
    setAgent(a => {
      const cur = (a.limits ?? {}) as Limits;
      const prev = (cur[bucket] ?? {}) as LimitCfg;
      return { ...a, limits: { ...cur, [bucket]: { ...prev, ...patch } } };
    });
  const fmtK = (n: number) => (n >= 1_000_000 ? `${(n / 1e6).toFixed(1)}M` : n >= 1_000 ? `${(n / 1e3).toFixed(0)}K` : `${Math.round(n)}`);
  const tokenHint = (usd: number): string => {
    if (!selectedPrice || !usd) return '';
    const hi = (usd / selectedPrice.inputPer1M) * 1e6;   // todo input (cota alta)
    const lo = (usd / selectedPrice.outputPer1M) * 1e6;  // todo output (cota baja)
    return `≈ ${fmtK(lo)}–${fmtK(hi)} tokens`;
  };

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
    await fetch('/api/skills', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ agentId: id, skillId, action: assigned ? 'unassign' : 'assign' }),
    });
    if (assigned) {
      setSkills(s => s.filter((x: any) => x.id !== skillId));
    } else {
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

  // ── Subagentes: habilita/deshabilita otro agente como subagente de este.
  // Auto-crea la delegación (API key + http-tool /invoke) si no existe y la
  // asigna/desasigna. El usuario no toca «Herramientas» para nada.
  const [subBusy, setSubBusy] = useState<string | null>(null);
  const [subError, setSubError] = useState('');

  // Devuelve la delegate-tool que apunta a targetId, creándola si hace falta.
  const ensureDelegation = async (target: any) => {
    const existing = allHttpTools.find((t: any) => delegateTargetId(t.url) === target.id);
    if (existing) return existing;
    // 1. API key del subagente
    const keyRes = await fetch('/api/agentes/v1/keys', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ agent_id: target.id, name: `delegate: ${target.slug || target.id}` }),
    });
    if (!keyRes.ok) throw new Error('No se pudo generar la API key del subagente.');
    const key = await keyRes.json();
    // 2. delegate-tool
    const toolName = `consultar_${target.slug || 'subagente'}`;
    const toolRes = await fetch('/api/agentes/v1/http-tools', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: toolName, slug: toolName,
        description: `Delega en el subagente "${target.name}" para responder. Pasa la pregunta del usuario tal cual en prompt.`,
        http_method: 'POST', url: buildInvokeUrl(target.id),
        headers: { Authorization: `Bearer ${key.token}`, 'Content-Type': 'application/json' },
        input_schema: delegateInputSchema(), enabled: true,
      }),
    });
    if (!toolRes.ok) throw new Error('No se pudo crear la delegación.');
    const tool = await toolRes.json();
    setAllHttpTools((s: any[]) => [...s, tool]);
    return tool;
  };

  const toggleSubagent = async (target: any, currentlyOn: boolean) => {
    setSubBusy(target.id); setSubError('');
    try {
      if (currentlyOn) {
        const tool = httpTools.find((t: any) => delegateTargetId(t.url) === target.id);
        if (tool) {
          await fetch(`/api/agentes/v1/agents/${id}/http-tools/${tool.id}`, { method: 'DELETE' });
          setHttpTools(s => s.filter((x: any) => x.id !== tool.id));
        }
      } else {
        const tool = await ensureDelegation(target);
        if (!httpTools.some((x: any) => x.id === tool.id)) {
          await fetch(`/api/agentes/v1/agents/${id}/http-tools/${tool.id}`, { method: 'POST' });
          setHttpTools(s => [...s, tool]);
        }
      }
    } catch (e: any) {
      setSubError(e?.message || String(e));
    } finally {
      setSubBusy(null);
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
          <div className="flex items-center gap-2">
            <h2 className="text-2xl font-bold text-neutral-900 dark:text-[#e5e5e5] tracking-tight">
              {isNew ? 'Nuevo agente' : (agent.name ?? '…')}
            </h2>
            {!isNew && allHttpTools.some((t: any) => delegateTargetId(t.url) === id) && (
              <span className="text-[11px] px-2 py-0.5 rounded-full bg-[#71BF44]/15 text-[#5ea832] dark:text-[#71BF44] font-medium" title="Otro agente delega en este vía una herramienta de subagente">
                Subagente
              </span>
            )}
          </div>
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
        {/* Sub-navegación del editor */}
        <nav className="flex flex-wrap gap-1 bg-neutral-100 dark:bg-neutral-900 rounded-lg p-1 w-fit">
          {([
            { key: 'general', label: 'General', show: true },
            { key: 'prompt', label: 'Prompt', show: true },
            { key: 'capacidades', label: 'Capacidades y límites', show: true },
            { key: 'conexiones', label: 'Skills · MCP · Tools', show: !isNew },
            { key: 'subagentes', label: 'Subagentes', show: !isNew },
          ] as const).filter(t => t.show).map(t => (
            <button
              key={t.key}
              type="button"
              onClick={() => setTab(t.key)}
              className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                tab === t.key
                  ? 'bg-white dark:bg-[#1e1e1e] shadow-sm text-neutral-900 dark:text-white'
                  : 'text-neutral-500 dark:text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200'
              }`}
            >
              {t.label}
            </button>
          ))}
        </nav>

        {/* Básicos */}
        {tab === 'general' && (
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
                {modelOptions.map(m => <option key={m} value={m}>{m}{fmtPrice(m)}</option>)}
              </select>
              {selectedPrice && (
                <p className="text-[11px] text-neutral-400 mt-1">
                  Precio: <span className="font-mono">${selectedPrice.inputPer1M}</span> input · <span className="font-mono">${selectedPrice.outputPer1M}</span> output · <span className="font-mono">${selectedPrice.cachedPer1M}</span> cacheado · por 1M tokens
                </p>
              )}
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
        )}

        {/* Capabilities */}
        {tab === 'capacidades' && (
        <section className="bg-white dark:bg-[#131313] border border-neutral-200 dark:border-neutral-800 rounded-xl p-6 space-y-4">
          <div>
            <h3 className="font-semibold text-neutral-800 dark:text-neutral-200">Capacidades</h3>
            <p className="text-xs text-neutral-500 mt-0.5">Aplica a cualquier agente (principal o subagente). Pasos máximos, acceso a tools/skills y tools builtin del runtime. Apagar builtins de archivos/shell evita que el agente se distraiga; recomendado también en el principal.</p>
          </div>
          <div className="grid grid-cols-3 gap-4 items-end">
            <div>
              <label className="block text-xs text-neutral-500 mb-1">Pasos máximos</label>
              <input
                type="number" min={1} max={30}
                className="w-full bg-neutral-50 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-700 rounded-lg px-3 py-2 text-sm text-neutral-900 dark:text-white"
                value={caps.max_steps ?? 6}
                onChange={e => setCap({ max_steps: Number(e.target.value) || 1 })}
              />
            </div>
            <label className="flex items-center gap-2 cursor-pointer pb-2">
              <input type="checkbox" className="w-4 h-4 accent-[#71BF44]" checked={caps.allow_tools ?? true} onChange={e => setCap({ allow_tools: e.target.checked })} />
              <span className="text-sm text-neutral-700 dark:text-neutral-300">Permitir tools</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer pb-2">
              <input type="checkbox" className="w-4 h-4 accent-[#71BF44]" checked={caps.allow_skills ?? true} onChange={e => setCap({ allow_skills: e.target.checked })} />
              <span className="text-sm text-neutral-700 dark:text-neutral-300">Permitir skills</span>
            </label>
          </div>
          <div>
            <label className="block text-xs font-medium text-neutral-700 dark:text-neutral-300 mb-1">Tools builtin desactivadas</label>
            <p className="text-[11px] text-neutral-400 mb-2">Marca las que NO quieres que el agente pueda usar (filesystem, shell, etc.). Recomendado desactivar las de archivos/comandos en subagentes.</p>
            <div className="grid grid-cols-2 gap-x-4 gap-y-1">
              {BUILTIN_TOOLS.map(bt => {
                const off = disabledTools.includes(bt.name);
                return (
                  <label key={bt.name} className="flex items-center gap-2 cursor-pointer py-0.5">
                    <input type="checkbox" className="w-4 h-4 accent-red-500" checked={off} onChange={() => toggleBuiltin(bt.name, off)} />
                    <span className={`text-sm ${off ? 'text-red-600 dark:text-red-400 line-through' : 'text-neutral-700 dark:text-neutral-300'}`}>
                      {bt.label}
                    </span>
                    <code className="text-[10px] text-neutral-400">{bt.name}</code>
                    {bt.danger && !off && <span className="text-[10px] text-amber-500">⚠</span>}
                  </label>
                );
              })}
            </div>
          </div>
        </section>
        )}

        {/* Límites de uso */}
        {tab === 'capacidades' && (
        <section className="bg-white dark:bg-[#131313] border border-neutral-200 dark:border-neutral-800 rounded-xl p-6 space-y-4">
          <div>
            <h3 className="font-semibold text-neutral-800 dark:text-neutral-200">Límites de uso</h3>
            <p className="text-xs text-neutral-500 mt-0.5">
              Tope de gasto (USD) de este agente por ventana móvil. Al alcanzarlo: <strong>Solo notificar</strong> avisa y deja seguir (para flujos críticos que NO deben detenerse); <strong>Detener y notificar</strong> corta la corrida (flujos donde detenerse no es problema). El costo se calcula con el precio del modelo. Vacío = sin límite.
            </p>
          </div>
          <div className="space-y-2">
            <div className="grid grid-cols-[90px_1fr_1fr] gap-3 items-center text-[11px] text-neutral-400 uppercase tracking-wide px-1">
              <span>Ventana</span><span>Tope (USD)</span><span>Acción</span>
            </div>
            {BUCKETS.map(({ key, label }) => {
              const cfg: LimitCfg = (limits[key] ?? {}) as LimitCfg;
              const usd = cfg.usd ?? 0;
              return (
                <div key={key} className="grid grid-cols-[90px_1fr_1fr] gap-3 items-center">
                  <span className="text-sm text-neutral-600 dark:text-neutral-300">{label}</span>
                  <div>
                    <div className="flex items-center gap-1">
                      <span className="text-sm text-neutral-400">$</span>
                      <input
                        type="number" min={0} step={0.01} placeholder="sin límite"
                        className="w-full bg-neutral-50 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-700 rounded-lg px-3 py-2 text-sm text-neutral-900 dark:text-white"
                        value={usd || ''}
                        onChange={e => setLimit(key, { usd: Number(e.target.value) || 0 })}
                      />
                    </div>
                    {usd > 0 && tokenHint(usd) && (
                      <p className="text-[10px] text-neutral-400 mt-0.5 ml-4">{tokenHint(usd)}</p>
                    )}
                  </div>
                  <select
                    disabled={!usd}
                    className="w-full bg-neutral-50 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-700 rounded-lg px-3 py-2 text-sm text-neutral-900 dark:text-white disabled:opacity-40"
                    value={cfg.action ?? 'notify'}
                    onChange={e => setLimit(key, { action: e.target.value as 'notify' | 'stop' })}
                  >
                    <option value="notify">Solo notificar</option>
                    <option value="stop">Detener y notificar</option>
                  </select>
                </div>
              );
            })}
          </div>
        </section>
        )}

        {/* System prompt */}
        {tab === 'prompt' && (
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
            <div key={i} className="border border-neutral-200 dark:border-neutral-700 rounded-lg p-3 space-y-2">
              <div className="flex items-center gap-2">
                <span className="text-xs font-medium text-neutral-400 shrink-0">Sección {i + 1}</span>
                <input
                  type="text"
                  className="flex-1 bg-transparent border-b border-neutral-200 dark:border-neutral-700 px-1 py-0.5 text-sm font-semibold text-neutral-900 dark:text-white focus:outline-none focus:border-[#71BF44]"
                  placeholder="Título de la sección (ej: Identidad, Reglas RAG, Canal cliente…)"
                  value={sec.title ?? ''}
                  onChange={e => updateSection(i, 'title', e.target.value)}
                />
              </div>
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
              system_sections: [...(a.system_sections ?? []), { title: '', content: '' }],
            }))}
            className="text-xs text-[#71BF44] hover:underline"
          >
            + Añadir sección
          </button>
        </section>
        )}

        {/* Skills */}
        {!isNew && tab === 'conexiones' && (
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
        {!isNew && tab === 'conexiones' && (
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

        {/* Subagentes (delegaciones) */}
        {!isNew && tab === 'subagentes' && (
          <section className="bg-white dark:bg-[#131313] border border-neutral-200 dark:border-neutral-800 rounded-xl p-6 space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-semibold text-neutral-800 dark:text-neutral-200">Subagentes</h3>
                <p className="text-xs text-neutral-500 mt-0.5">Activa qué agentes puede invocar este agente. Al activarlo, la delegación se configura sola (API key + conexión).</p>
              </div>
              <button
                type="button"
                onClick={() => setShowSubagentWizard(true)}
                className="text-xs bg-[#71BF44] hover:bg-[#5ea832] text-white font-medium px-3 py-1.5 rounded-lg transition-colors whitespace-nowrap shrink-0"
              >
                + Crear subagente
              </button>
            </div>
            {subError && (
              <p className="text-sm text-red-500 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg px-3 py-2">{subError}</p>
            )}
            {allAgents.filter((a: any) => a.id !== id).length === 0 ? (
              <p className="text-sm text-neutral-400">
                No hay otros agentes. <button type="button" onClick={() => setShowSubagentWizard(true)} className="text-[#71BF44] hover:underline">Crea un subagente →</button>
              </p>
            ) : (
              <div className="space-y-1">
                {allAgents.filter((a: any) => a.id !== id).map((a: any) => {
                  const on = httpTools.some((t: any) => delegateTargetId(t.url) === a.id);
                  const busy = subBusy === a.id;
                  return (
                    <div key={a.id} className="flex items-center gap-3 rounded-lg border border-neutral-200 dark:border-neutral-800 px-3 py-2">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium text-neutral-800 dark:text-neutral-200 truncate">{a.name}</span>
                          {a.enabled === false && (
                            <span className="text-[10px] px-1.5 py-0.5 rounded bg-neutral-100 dark:bg-neutral-800 text-neutral-500">inactivo</span>
                          )}
                        </div>
                        {a.description && <span className="text-xs text-neutral-400 block truncate">{a.description}</span>}
                      </div>
                      <Link href={`/projects/agentes/${a.id}`} className="text-xs text-[#71BF44] hover:underline shrink-0">ver →</Link>
                      <button
                        type="button"
                        onClick={() => toggleSubagent(a, on)}
                        disabled={busy}
                        role="switch"
                        aria-checked={on}
                        className={`relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors disabled:opacity-50 ${
                          on ? 'bg-[#71BF44]' : 'bg-neutral-300 dark:bg-neutral-700'
                        }`}
                        title={on ? 'Deshabilitar como subagente' : 'Habilitar como subagente'}
                      >
                        <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${on ? 'translate-x-4' : 'translate-x-0.5'}`} />
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </section>
        )}

        {/* Herramientas HTTP (excluye delegaciones, que tienen su propia sección) */}
        {!isNew && tab === 'conexiones' && (
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
            {allHttpTools.filter((t: any) => !isDelegateTool(t)).length === 0 ? (
              <p className="text-sm text-neutral-400">No hay herramientas HTTP creadas aún.</p>
            ) : (
              <div className="space-y-2">
                {allHttpTools.filter((t: any) => !isDelegateTool(t)).map((t: any) => {
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

      {showSubagentWizard && !isNew && (
        <CrearSubagenteWizard
          parentAgentId={id}
          parentAgentName={agent.name}
          onClose={() => setShowSubagentWizard(false)}
          onCreated={reloadDelegations}
        />
      )}
    </>
  );
}

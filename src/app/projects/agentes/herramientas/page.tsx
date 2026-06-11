'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import AgentesNav from '@/components/agentes/AgentesNav';
import { buildInvokeUrl, delegateInputSchema, delegateTargetId, isDelegateTool } from '@/lib/agentes';

type AgentLite = { id: string; name: string; slug: string };

type HttpTool = {
  id: string;
  name: string;
  slug: string;
  description: string;
  http_method: string;
  url: string;
  headers: Record<string, string>;
  input_schema: Record<string, unknown>;
  enabled: boolean;
  created_at: string;
};

type KVPair = { key: string; value: string };

const METHODS = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'];

const METHOD_COLORS: Record<string, string> = {
  GET:    'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400',
  POST:   'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400',
  PUT:    'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400',
  PATCH:  'bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-400',
  DELETE: 'bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400',
};

const emptyTool = (): Partial<HttpTool> => ({
  name: '', slug: '', description: '', http_method: 'POST',
  url: '', headers: {}, input_schema: {}, enabled: true,
});

function slugify(s: string) {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

function toKV(obj: Record<string, string>): KVPair[] {
  return Object.entries(obj).map(([key, value]) => ({ key, value }));
}

function fromKV(pairs: KVPair[]): Record<string, string> {
  return Object.fromEntries(pairs.filter(p => p.key.trim()).map(p => [p.key.trim(), p.value]));
}

function KVEditor({
  pairs, onChange, keyPlaceholder = 'Header', valuePlaceholder = 'valor', secret = false,
}: {
  pairs: KVPair[]; onChange: (p: KVPair[]) => void;
  keyPlaceholder?: string; valuePlaceholder?: string; secret?: boolean;
}) {
  const add = () => onChange([...pairs, { key: '', value: '' }]);
  const remove = (i: number) => onChange(pairs.filter((_, idx) => idx !== i));
  const update = (i: number, field: 'key' | 'value', val: string) =>
    onChange(pairs.map((p, idx) => idx === i ? { ...p, [field]: val } : p));

  return (
    <div className="space-y-2">
      {pairs.map((p, i) => (
        <div key={i} className="flex gap-2 items-center">
          <input
            className="flex-1 min-w-0 bg-neutral-50 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-700 rounded-lg px-3 py-1.5 text-xs font-mono text-neutral-900 dark:text-white"
            placeholder={keyPlaceholder}
            value={p.key}
            onChange={e => update(i, 'key', e.target.value)}
          />
          <input
            className="flex-1 min-w-0 bg-neutral-50 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-700 rounded-lg px-3 py-1.5 text-xs font-mono text-neutral-900 dark:text-white"
            placeholder={valuePlaceholder}
            type={secret ? 'password' : 'text'}
            value={p.value}
            onChange={e => update(i, 'value', e.target.value)}
          />
          <button
            type="button"
            onClick={() => remove(i)}
            className="text-neutral-400 hover:text-red-500 flex-shrink-0 transition-colors"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      ))}
      <button type="button" onClick={add} className="text-xs text-[#71BF44] hover:underline">
        + Añadir
      </button>
    </div>
  );
}

export default function HerramientasPage() {
  const [tools, setTools] = useState<HttpTool[]>([]);
  const [editing, setEditing] = useState<Partial<HttpTool> | null>(null);
  const [headerPairs, setHeaderPairs] = useState<KVPair[]>([]);
  const [schemaText, setSchemaText] = useState('{}');
  const [schemaError, setSchemaError] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [deleting, setDeleting] = useState<string | null>(null);
  const [expandedHeaders, setExpandedHeaders] = useState<string | null>(null);
  // Subagentes (delegación)
  const [agents, setAgents] = useState<AgentLite[]>([]);
  const [mode, setMode] = useState<'http' | 'delegate'>('http');
  const [targetAgentId, setTargetAgentId] = useState('');
  const [genningKey, setGenningKey] = useState(false);
  const [keyNote, setKeyNote] = useState('');

  const load = () =>
    fetch('/api/agentes/v1/http-tools').then(r => r.json()).then(setTools).catch(() => {});

  useEffect(() => {
    load();
    fetch('/api/agentes/v1/agents').then(r => r.json()).then(d => Array.isArray(d) && setAgents(d)).catch(() => {});
  }, []);

  const openEditor = (t: Partial<HttpTool>) => {
    setEditing(t);
    setHeaderPairs(toKV((t.headers ?? {}) as Record<string, string>));
    setSchemaText(JSON.stringify(t.input_schema ?? {}, null, 2));
    setSchemaError('');
    setError('');
    const tgt = delegateTargetId(t.url);
    setMode(tgt ? 'delegate' : 'http');
    setTargetAgentId(tgt ?? '');
    setKeyNote('');
  };

  // Al elegir el agente destino, autoarma URL/método/schema y nombre por defecto.
  const pickTarget = (agentId: string) => {
    setTargetAgentId(agentId);
    const ag = agents.find(a => a.id === agentId);
    if (!ag) return;
    setEditing(ed => {
      const baseName = `consultar_${ag.slug || 'subagente'}`;
      return {
        ...ed!,
        http_method: 'POST',
        url: buildInvokeUrl(agentId),
        name: ed?.name || baseName,
        slug: ed?.slug || baseName,
        description: ed?.description || `Delega en el subagente "${ag.name}" para responder. Pasa la pregunta del usuario tal cual en prompt.`,
      };
    });
    setSchemaText(JSON.stringify(delegateInputSchema(), null, 2));
  };

  // Crea una API key del subagente destino y la embebe como header Authorization.
  const generateKey = async () => {
    if (!targetAgentId) return;
    setGenningKey(true); setKeyNote('');
    try {
      const res = await fetch('/api/agentes/v1/keys', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ agent_id: targetAgentId, name: `delegate: ${editing?.slug || 'router'}` }),
      });
      if (!res.ok) throw new Error(await res.text());
      const data = await res.json();
      const others = headerPairs.filter(p => p.key.toLowerCase() !== 'authorization' && p.key.toLowerCase() !== 'content-type');
      setHeaderPairs([
        { key: 'Authorization', value: `Bearer ${data.token}` },
        { key: 'Content-Type', value: 'application/json' },
        ...others,
      ]);
      setKeyNote('API key generada y embebida en Authorization ✓');
    } catch (e: any) {
      setKeyNote('Error al generar la key: ' + e.message);
    } finally {
      setGenningKey(false);
    }
  };

  const hasAuth = headerPairs.some(p => p.key.toLowerCase() === 'authorization' && p.value.trim());

  const openNew = (m: 'http' | 'delegate') => {
    openEditor(emptyTool());
    setMode(m);
    if (m === 'delegate') {
      setSchemaText(JSON.stringify(delegateInputSchema(), null, 2));
      setEditing(ed => ({ ...ed!, http_method: 'POST' }));
    }
  };

  const validateSchema = (text: string): boolean => {
    try {
      JSON.parse(text);
      setSchemaError('');
      return true;
    } catch {
      setSchemaError('JSON inválido');
      return false;
    }
  };

  const save = async () => {
    if (!validateSchema(schemaText)) return;
    if (mode === 'delegate') {
      if (!targetAgentId || !editing?.url) { setError('Elige el subagente destino.'); return; }
      if (!hasAuth) { setError('Genera la API key del subagente (header Authorization).'); return; }
    }
    setSaving(true); setError('');
    try {
      const payload = {
        ...editing,
        headers: fromKV(headerPairs),
        input_schema: JSON.parse(schemaText),
      };
      const isNew = !editing?.id;
      const url = isNew ? '/api/agentes/v1/http-tools' : `/api/agentes/v1/http-tools/${editing!.id}`;
      const res = await fetch(url, {
        method: isNew ? 'POST' : 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error(await res.text());
      await load();
      setEditing(null);
    } catch (e: any) { setError(e.message); }
    finally { setSaving(false); }
  };

  const del = async (id: string) => {
    if (!confirm('¿Eliminar esta herramienta?')) return;
    setDeleting(id);
    await fetch(`/api/agentes/v1/http-tools/${id}`, { method: 'DELETE' });
    await load();
    setDeleting(null);
  };

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
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold text-neutral-900 dark:text-[#e5e5e5] tracking-tight">Agentes IA</h2>
            <p className="text-sm text-neutral-500 dark:text-[#ababab] mt-1">
              Herramientas HTTP — APIs y webhooks disponibles para los agentes.
            </p>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => openNew('delegate')}
              className="flex items-center gap-2 border border-[#71BF44] text-[#71BF44] hover:bg-[#71BF44]/10 text-sm font-medium px-4 py-2 rounded-lg transition-colors"
            >
              Delegar a subagente
            </button>
            <button
              onClick={() => openNew('http')}
              className="flex items-center gap-2 bg-[#71BF44] hover:bg-[#5ea832] text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              Nueva herramienta
            </button>
          </div>
        </div>
      </header>

      <AgentesNav />

      {/* Modal editor */}
      {editing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="bg-white dark:bg-[#131313] border border-neutral-200 dark:border-neutral-800 rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between px-6 py-4 border-b border-neutral-200 dark:border-neutral-800">
              <h3 className="font-semibold text-neutral-900 dark:text-white">
                {editing.id
                  ? (mode === 'delegate' ? 'Editar delegación a subagente' : 'Editar herramienta')
                  : (mode === 'delegate' ? 'Delegar a subagente' : 'Nueva herramienta HTTP')}
              </h3>
              <button onClick={() => setEditing(null)} className="text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-200">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="overflow-y-auto flex-1 px-6 py-4 space-y-5">
              {/* Tipo: HTTP genérica o Delegar a subagente */}
              <div>
                <label className="block text-xs text-neutral-500 mb-1">Tipo de herramienta</label>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setMode('http')}
                    className={`flex-1 px-3 py-2 rounded-lg text-xs font-medium border transition-colors ${
                      mode === 'http'
                        ? 'bg-[#71BF44] border-[#71BF44] text-white'
                        : 'border-neutral-200 dark:border-neutral-700 text-neutral-600 dark:text-neutral-300 hover:border-[#71BF44]/50'
                    }`}
                  >
                    HTTP genérica
                  </button>
                  <button
                    type="button"
                    onClick={() => { setMode('delegate'); setEditing(ed => ({ ...ed!, http_method: 'POST' })); if (!delegateTargetId(editing?.url)) setSchemaText(JSON.stringify(delegateInputSchema(), null, 2)); }}
                    className={`flex-1 px-3 py-2 rounded-lg text-xs font-medium border transition-colors ${
                      mode === 'delegate'
                        ? 'bg-[#71BF44] border-[#71BF44] text-white'
                        : 'border-neutral-200 dark:border-neutral-700 text-neutral-600 dark:text-neutral-300 hover:border-[#71BF44]/50'
                    }`}
                  >
                    Subagente (delegar)
                  </button>
                </div>
                {mode === 'delegate' && (
                  <p className="text-[11px] text-neutral-400 mt-2">
                    El agente padre gana una tool ligera que delega en el subagente; el MCP pesado solo se carga dentro del subagente.
                  </p>
                )}
              </div>

              {/* Agente destino (modo delegar) */}
              {mode === 'delegate' && (
                <div>
                  <label className="block text-xs text-neutral-500 mb-1">Subagente destino *</label>
                  <select
                    className="w-full bg-neutral-50 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-700 rounded-lg px-3 py-2 text-sm text-neutral-900 dark:text-white"
                    value={targetAgentId}
                    onChange={e => pickTarget(e.target.value)}
                  >
                    <option value="">— Elige un agente —</option>
                    {agents.map(a => (
                      <option key={a.id} value={a.id}>{a.name}</option>
                    ))}
                  </select>
                </div>
              )}

              {/* Nombre + slug */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs text-neutral-500 mb-1">Nombre *</label>
                  <input
                    className="w-full bg-neutral-50 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-700 rounded-lg px-3 py-2 text-sm text-neutral-900 dark:text-white"
                    value={editing.name ?? ''}
                    onChange={e => setEditing(ed => ({
                      ...ed!, name: e.target.value,
                      slug: ed?.slug || slugify(e.target.value),
                    }))}
                    placeholder="SEQ Buscar Eventos"
                  />
                </div>
                <div>
                  <label className="block text-xs text-neutral-500 mb-1">Slug *</label>
                  <input
                    className="w-full bg-neutral-50 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-700 rounded-lg px-3 py-2 text-sm text-neutral-900 dark:text-white font-mono"
                    value={editing.slug ?? ''}
                    onChange={e => setEditing(ed => ({ ...ed!, slug: e.target.value }))}
                    placeholder="seq-buscar-eventos"
                  />
                </div>
              </div>

              {/* Descripción */}
              <div>
                <label className="block text-xs text-neutral-500 mb-1">
                  Descripción
                  <span className="ml-1 text-neutral-400">(el agente usa esto para decidir cuándo llamar la herramienta)</span>
                </label>
                <textarea
                  rows={2}
                  className="w-full bg-neutral-50 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-700 rounded-lg px-3 py-2 text-sm text-neutral-900 dark:text-white resize-none"
                  value={editing.description ?? ''}
                  onChange={e => setEditing(ed => ({ ...ed!, description: e.target.value }))}
                  placeholder="Busca eventos de log en SEQ filtrando por nivel, aplicación o texto..."
                />
              </div>

              {/* Método + URL */}
              <div>
                {mode === 'http' && (
                  <>
                    <label className="block text-xs text-neutral-500 mb-1">Método *</label>
                    <div className="flex gap-2 mb-3">
                      {METHODS.map(m => (
                        <button
                          key={m}
                          type="button"
                          onClick={() => setEditing(ed => ({ ...ed!, http_method: m }))}
                          className={`flex-1 px-3 py-2 rounded-lg text-xs font-bold border transition-colors ${
                            editing.http_method === m
                              ? 'bg-[#71BF44] border-[#71BF44] text-white'
                              : 'border-neutral-200 dark:border-neutral-700 text-neutral-600 dark:text-neutral-300 hover:border-[#71BF44]/50'
                          }`}
                        >
                          {m}
                        </button>
                      ))}
                    </div>
                  </>
                )}
                <label className="block text-xs text-neutral-500 mb-1">
                  URL * {mode === 'delegate' && <span className="text-neutral-400 font-normal">(auto: /invoke del subagente)</span>}
                </label>
                <input
                  readOnly={mode === 'delegate'}
                  className={`w-full border border-neutral-200 dark:border-neutral-700 rounded-lg px-3 py-2 text-sm text-neutral-900 dark:text-white font-mono ${mode === 'delegate' ? 'bg-neutral-100 dark:bg-neutral-800 text-neutral-500' : 'bg-neutral-50 dark:bg-neutral-900'}`}
                  value={editing.url ?? ''}
                  onChange={e => setEditing(ed => ({ ...ed!, url: e.target.value }))}
                  placeholder={mode === 'delegate' ? 'Elige el subagente arriba' : 'http://logs-prod.mysatcomla.com:5341/api/events'}
                />
              </div>

              {/* Autenticación del subagente (modo delegar) */}
              {mode === 'delegate' && (
                <div className="rounded-lg border border-neutral-200 dark:border-neutral-700 p-3">
                  <label className="block text-xs font-medium text-neutral-700 dark:text-neutral-300 mb-2">
                    Autenticación con el subagente
                  </label>
                  <div className="flex items-center gap-3">
                    <button
                      type="button"
                      onClick={generateKey}
                      disabled={!targetAgentId || genningKey}
                      className="text-xs bg-[#71BF44] hover:bg-[#5ea832] disabled:opacity-50 text-white font-medium px-3 py-1.5 rounded-lg transition-colors"
                    >
                      {genningKey ? 'Generando…' : (hasAuth ? 'Regenerar API key' : 'Generar API key del subagente')}
                    </button>
                    <span className={`text-xs ${hasAuth ? 'text-green-600 dark:text-green-400' : 'text-amber-600 dark:text-amber-400'}`}>
                      {hasAuth ? 'Authorization configurado ✓' : 'Falta el header Authorization'}
                    </span>
                  </div>
                  {keyNote && <p className="text-[11px] text-neutral-500 dark:text-neutral-400 mt-2">{keyNote}</p>}
                  <p className="text-[11px] text-neutral-400 mt-2">
                    Crea una API key del subagente y la embebe como <code>Authorization: Bearer …</code>. La key no se vuelve a mostrar.
                  </p>
                </div>
              )}

              {/* Headers */}
              {mode === 'http' && (
                <div>
                  <label className="block text-xs font-medium text-neutral-700 dark:text-neutral-300 mb-2">
                    Headers HTTP
                    <span className="ml-1 text-neutral-400 font-normal">(API keys, Authorization, etc.)</span>
                  </label>
                  <KVEditor
                    pairs={headerPairs}
                    onChange={setHeaderPairs}
                    keyPlaceholder="X-Seq-ApiKey"
                    valuePlaceholder="tu-api-key"
                    secret
                  />
                </div>
              )}

              {/* Input Schema (oculto en modo delegar: es fijo {prompt}) */}
              {mode === 'http' && (
                <div>
                  <label className="block text-xs font-medium text-neutral-700 dark:text-neutral-300 mb-1">
                    Input Schema
                    <span className="ml-1 text-neutral-400 font-normal">(JSON Schema — parámetros que acepta la herramienta)</span>
                  </label>
                  <textarea
                    rows={8}
                    spellCheck={false}
                    className={`w-full bg-neutral-50 dark:bg-neutral-900 border rounded-lg px-3 py-2 text-xs font-mono text-neutral-900 dark:text-white resize-y ${
                      schemaError
                        ? 'border-red-400 dark:border-red-600'
                        : 'border-neutral-200 dark:border-neutral-700'
                    }`}
                    value={schemaText}
                    onChange={e => { setSchemaText(e.target.value); validateSchema(e.target.value); }}
                    placeholder='{"type":"object","properties":{"filter":{"type":"string","description":"Expresión de filtro CLEF"}}}'
                  />
                  {schemaError && (
                    <p className="text-xs text-red-500 mt-1">{schemaError}</p>
                  )}
                </div>
              )}
              {mode === 'delegate' && (
                <p className="text-[11px] text-neutral-400">
                  Parámetro fijo: <code>prompt</code> (la pregunta del usuario). El subagente la resuelve internamente.
                </p>
              )}

              {/* Habilitado */}
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  className="w-4 h-4 accent-[#71BF44]"
                  checked={editing.enabled ?? true}
                  onChange={e => setEditing(ed => ({ ...ed!, enabled: e.target.checked }))}
                />
                <span className="text-sm text-neutral-700 dark:text-neutral-300">Herramienta activa</span>
              </label>

              {error && (
                <p className="text-sm text-red-500 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg px-4 py-2">{error}</p>
              )}
            </div>

            <div className="flex justify-end gap-3 px-6 py-4 border-t border-neutral-200 dark:border-neutral-800">
              <button onClick={() => setEditing(null)} className="text-sm border border-neutral-300 dark:border-neutral-700 text-neutral-600 dark:text-neutral-300 px-4 py-2 rounded-lg hover:bg-neutral-50 dark:hover:bg-neutral-800 transition-colors">
                Cancelar
              </button>
              <button onClick={save} disabled={saving || !!schemaError} className="bg-[#71BF44] hover:bg-[#5ea832] disabled:opacity-50 text-white text-sm font-medium px-5 py-2 rounded-lg transition-colors">
                {saving ? 'Guardando…' : 'Guardar'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Lista */}
      {tools.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <div className="w-16 h-16 rounded-full bg-[#71BF44]/10 flex items-center justify-center mb-4">
            <svg className="w-8 h-8 text-[#71BF44]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
            </svg>
          </div>
          <p className="text-neutral-500 dark:text-neutral-400 text-sm">No hay herramientas HTTP configuradas.</p>
          <button onClick={() => openEditor(emptyTool())} className="mt-3 text-sm text-[#71BF44] hover:underline">
            Crear la primera →
          </button>
        </div>
      ) : (
        <div className="space-y-2">
          {tools.map(t => {
            const headerKeys = Object.keys(t.headers ?? {});
            const schemaProps = Object.keys((t.input_schema as any)?.properties ?? {});
            return (
              <div
                key={t.id}
                className="bg-white dark:bg-[#131313] border border-neutral-200 dark:border-neutral-800 rounded-xl px-5 py-4 group hover:border-[#71BF44]/50 transition-colors"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <span className={`text-xs font-bold px-2.5 py-1 rounded-md flex-shrink-0 ${METHOD_COLORS[t.http_method] ?? 'bg-neutral-100 dark:bg-neutral-800 text-neutral-600'}`}>
                      {t.http_method}
                    </span>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-semibold text-neutral-900 dark:text-white">{t.name}</span>
                        {isDelegateTool(t) && (
                          <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-[#71BF44]/15 text-[#5ea832] dark:text-[#71BF44] font-medium">
                            {agents.find(a => a.id === delegateTargetId(t.url))?.name ?? 'subagente'}
                          </span>
                        )}
                        {!t.enabled && (
                          <span className="text-xs px-1.5 py-0.5 rounded bg-neutral-100 dark:bg-neutral-800 text-neutral-500">inactivo</span>
                        )}
                      </div>
                      <p className="text-xs text-neutral-400 font-mono mt-0.5 truncate max-w-md">{t.url}</p>
                      {t.description && (
                        <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-0.5 truncate max-w-md">{t.description}</p>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
                    {headerKeys.length > 0 && (
                      <button
                        onClick={() => setExpandedHeaders(expandedHeaders === t.id ? null : t.id)}
                        className="text-xs px-3 py-1.5 rounded-lg border border-amber-200 dark:border-amber-800 text-amber-600 dark:text-amber-400 hover:bg-amber-50 dark:hover:bg-amber-900/20 transition-colors"
                      >
                        🔑 {headerKeys.length}
                      </button>
                    )}
                    {schemaProps.length > 0 && (
                      <span className="text-xs px-2.5 py-1.5 rounded-lg border border-neutral-200 dark:border-neutral-700 text-neutral-500">
                        {schemaProps.length} param{schemaProps.length > 1 ? 's' : ''}
                      </span>
                    )}
                    <button
                      onClick={() => openEditor({ ...t })}
                      className="text-xs px-3 py-1.5 rounded-lg border border-neutral-200 dark:border-neutral-700 text-neutral-600 dark:text-neutral-300 hover:bg-neutral-50 dark:hover:bg-neutral-800 transition-colors"
                    >
                      Editar
                    </button>
                    <button
                      onClick={() => del(t.id)}
                      disabled={deleting === t.id}
                      className="text-xs px-3 py-1.5 rounded-lg border border-red-200 dark:border-red-800 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors disabled:opacity-50"
                    >
                      {deleting === t.id ? '…' : 'Eliminar'}
                    </button>
                  </div>
                </div>

                {expandedHeaders === t.id && headerKeys.length > 0 && (
                  <div className="mt-3 pt-3 border-t border-neutral-100 dark:border-neutral-800">
                    <p className="text-xs text-neutral-400 mb-2">Headers configurados:</p>
                    <div className="flex flex-wrap gap-2">
                      {headerKeys.map(k => (
                        <span key={k} className="text-xs font-mono bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-300 px-2 py-0.5 rounded">
                          {k}=<span className="text-neutral-400">••••••</span>
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </>
  );
}

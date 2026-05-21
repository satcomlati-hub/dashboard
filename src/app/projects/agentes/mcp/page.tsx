'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import AgentesNav from '@/components/agentes/AgentesNav';

type McpServer = {
  id: string; name: string; slug: string; transport: string;
  command: string | null; args: string[]; env: Record<string, string>;
  url: string | null; headers: Record<string, string>;
  enabled: boolean; created_at: string;
};

type KVPair = { key: string; value: string };

const TRANSPORTS = ['stdio', 'sse', 'http'];

const emptyServer = (): Partial<McpServer> => ({
  name: '', slug: '', transport: 'stdio',
  command: '', args: [], env: {}, url: '', headers: {}, enabled: true,
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
  pairs, onChange, keyPlaceholder = 'VARIABLE', valuePlaceholder = 'valor',
  secret = false,
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

export default function McpPage() {
  const [servers, setServers] = useState<McpServer[]>([]);
  const [editing, setEditing] = useState<Partial<McpServer> | null>(null);
  const [envPairs, setEnvPairs] = useState<KVPair[]>([]);
  const [headerPairs, setHeaderPairs] = useState<KVPair[]>([]);
  const [argLines, setArgLines] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [deleting, setDeleting] = useState<string | null>(null);
  const [expandedEnv, setExpandedEnv] = useState<string | null>(null);

  const load = () =>
    fetch('/api/agentes/v1/mcp-servers').then(r => r.json()).then(setServers).catch(() => {});

  useEffect(() => { load(); }, []);

  const openEditor = (s: Partial<McpServer>) => {
    setEditing(s);
    setEnvPairs(toKV(s.env ?? {}));
    setHeaderPairs(toKV(s.headers ?? {}));
    setArgLines((s.args ?? []).join('\n'));
    setError('');
  };

  const save = async () => {
    setSaving(true); setError('');
    try {
      const payload = {
        ...editing,
        env: fromKV(envPairs),
        headers: fromKV(headerPairs),
        args: argLines.split('\n').map(l => l.trim()).filter(Boolean),
      };
      const isNew = !editing?.id;
      const url = isNew ? '/api/agentes/v1/mcp-servers' : `/api/agentes/v1/mcp-servers/${editing!.id}`;
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
    if (!confirm('¿Eliminar este servidor MCP?')) return;
    setDeleting(id);
    await fetch(`/api/agentes/v1/mcp-servers/${id}`, { method: 'DELETE' });
    await load();
    setDeleting(null);
  };

  const transportIcon = (t: string) =>
    t === 'stdio' ? '⌨️' : t === 'sse' ? '📡' : '🌐';

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
              Configura servidores MCP y sus API keys externas.
            </p>
          </div>
          <button
            onClick={() => openEditor(emptyServer())}
            className="flex items-center gap-2 bg-[#71BF44] hover:bg-[#5ea832] text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Nuevo servidor
          </button>
        </div>
      </header>

      <AgentesNav />

      {/* Modal editor */}
      {editing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="bg-white dark:bg-[#131313] border border-neutral-200 dark:border-neutral-800 rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between px-6 py-4 border-b border-neutral-200 dark:border-neutral-800">
              <h3 className="font-semibold text-neutral-900 dark:text-white">
                {editing.id ? 'Editar servidor MCP' : 'Nuevo servidor MCP'}
              </h3>
              <button onClick={() => setEditing(null)} className="text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-200">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="overflow-y-auto flex-1 px-6 py-4 space-y-5">
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
                    placeholder="Mi servidor MCP"
                  />
                </div>
                <div>
                  <label className="block text-xs text-neutral-500 mb-1">Slug *</label>
                  <input
                    className="w-full bg-neutral-50 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-700 rounded-lg px-3 py-2 text-sm text-neutral-900 dark:text-white font-mono"
                    value={editing.slug ?? ''}
                    onChange={e => setEditing(ed => ({ ...ed!, slug: e.target.value }))}
                    placeholder="mi-servidor-mcp"
                  />
                </div>
              </div>

              {/* Transport */}
              <div>
                <label className="block text-xs text-neutral-500 mb-1">Transporte *</label>
                <div className="flex gap-2">
                  {TRANSPORTS.map(t => (
                    <button
                      key={t}
                      type="button"
                      onClick={() => setEditing(ed => ({ ...ed!, transport: t }))}
                      className={`flex-1 px-3 py-2 rounded-lg text-sm font-medium border transition-colors ${
                        editing.transport === t
                          ? 'bg-[#71BF44] border-[#71BF44] text-white'
                          : 'border-neutral-200 dark:border-neutral-700 text-neutral-600 dark:text-neutral-300 hover:border-[#71BF44]/50'
                      }`}
                    >
                      {t}
                    </button>
                  ))}
                </div>
              </div>

              {/* stdio fields */}
              {editing.transport === 'stdio' && (
                <>
                  <div>
                    <label className="block text-xs text-neutral-500 mb-1">Comando</label>
                    <input
                      className="w-full bg-neutral-50 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-700 rounded-lg px-3 py-2 text-sm text-neutral-900 dark:text-white font-mono"
                      value={editing.command ?? ''}
                      onChange={e => setEditing(ed => ({ ...ed!, command: e.target.value }))}
                      placeholder="npx @modelcontextprotocol/server-filesystem"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-neutral-500 mb-1">Argumentos (uno por línea)</label>
                    <textarea
                      rows={3}
                      className="w-full bg-neutral-50 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-700 rounded-lg px-3 py-2 text-xs font-mono text-neutral-900 dark:text-white resize-none"
                      value={argLines}
                      onChange={e => setArgLines(e.target.value)}
                      placeholder="/home/usuario/documentos"
                      spellCheck={false}
                    />
                  </div>
                </>
              )}

              {/* sse / http fields */}
              {(editing.transport === 'sse' || editing.transport === 'http') && (
                <>
                  <div>
                    <label className="block text-xs text-neutral-500 mb-1">URL *</label>
                    <input
                      className="w-full bg-neutral-50 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-700 rounded-lg px-3 py-2 text-sm text-neutral-900 dark:text-white font-mono"
                      value={editing.url ?? ''}
                      onChange={e => setEditing(ed => ({ ...ed!, url: e.target.value }))}
                      placeholder="https://mi-servidor-mcp.com/mcp"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-neutral-500 mb-2">
                      Headers HTTP
                      <span className="ml-1 text-neutral-400">(para autenticación Bearer, etc.)</span>
                    </label>
                    <KVEditor
                      pairs={headerPairs}
                      onChange={setHeaderPairs}
                      keyPlaceholder="Authorization"
                      valuePlaceholder="Bearer sk-..."
                      secret
                    />
                  </div>
                </>
              )}

              {/* API Keys / env vars */}
              <div className="border-t border-neutral-200 dark:border-neutral-800 pt-4">
                <label className="block text-xs font-medium text-neutral-700 dark:text-neutral-300 mb-1">
                  🔑 API Keys / Variables de entorno
                </label>
                <p className="text-xs text-neutral-400 mb-3">
                  Las variables declaradas aquí se inyectan en el entorno del proceso MCP (solo para transporte stdio) o se almacenan como referencia. Trátalas como secretos.
                </p>
                <KVEditor
                  pairs={envPairs}
                  onChange={setEnvPairs}
                  keyPlaceholder="OPENAI_API_KEY"
                  valuePlaceholder="sk-..."
                  secret
                />
              </div>

              {/* Habilitado */}
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  className="w-4 h-4 accent-[#71BF44]"
                  checked={editing.enabled ?? true}
                  onChange={e => setEditing(ed => ({ ...ed!, enabled: e.target.checked }))}
                />
                <span className="text-sm text-neutral-700 dark:text-neutral-300">Servidor activo</span>
              </label>

              {error && (
                <p className="text-sm text-red-500 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg px-4 py-2">{error}</p>
              )}
            </div>

            <div className="flex justify-end gap-3 px-6 py-4 border-t border-neutral-200 dark:border-neutral-800">
              <button onClick={() => setEditing(null)} className="text-sm border border-neutral-300 dark:border-neutral-700 text-neutral-600 dark:text-neutral-300 px-4 py-2 rounded-lg hover:bg-neutral-50 dark:hover:bg-neutral-800 transition-colors">
                Cancelar
              </button>
              <button onClick={save} disabled={saving} className="bg-[#71BF44] hover:bg-[#5ea832] disabled:opacity-50 text-white text-sm font-medium px-5 py-2 rounded-lg transition-colors">
                {saving ? 'Guardando…' : 'Guardar'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Lista */}
      {servers.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <div className="w-16 h-16 rounded-full bg-[#71BF44]/10 flex items-center justify-center mb-4">
            <svg className="w-8 h-8 text-[#71BF44]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M5 12h14M5 12a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v4a2 2 0 01-2 2M5 12a2 2 0 00-2 2v4a2 2 0 002 2h14a2 2 0 002-2v-4a2 2 0 00-2-2m-2-4h.01M17 16h.01" />
            </svg>
          </div>
          <p className="text-neutral-500 dark:text-neutral-400 text-sm">No hay servidores MCP configurados.</p>
          <button onClick={() => openEditor(emptyServer())} className="mt-3 text-sm text-[#71BF44] hover:underline">
            Configurar el primero →
          </button>
        </div>
      ) : (
        <div className="space-y-2">
          {servers.map(s => {
            const envKeys = Object.keys(s.env ?? {});
            return (
              <div
                key={s.id}
                className="bg-white dark:bg-[#131313] border border-neutral-200 dark:border-neutral-800 rounded-xl px-5 py-4 group hover:border-[#71BF44]/50 transition-colors"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="w-9 h-9 rounded-lg bg-[#71BF44]/10 flex items-center justify-center flex-shrink-0 text-base">
                      {transportIcon(s.transport)}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-semibold text-neutral-900 dark:text-white">{s.name}</span>
                        <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${
                          s.enabled
                            ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400'
                            : 'bg-neutral-100 dark:bg-neutral-800 text-neutral-500'
                        }`}>
                          {s.transport}
                        </span>
                      </div>
                      <p className="text-xs text-neutral-400 font-mono mt-0.5">
                        {s.transport === 'stdio' ? (s.command ?? '—') : (s.url ?? '—')}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                    {envKeys.length > 0 && (
                      <button
                        onClick={() => setExpandedEnv(expandedEnv === s.id ? null : s.id)}
                        className="text-xs px-3 py-1.5 rounded-lg border border-amber-200 dark:border-amber-800 text-amber-600 dark:text-amber-400 hover:bg-amber-50 dark:hover:bg-amber-900/20 transition-colors"
                      >
                        🔑 {envKeys.length} key{envKeys.length > 1 ? 's' : ''}
                      </button>
                    )}
                    <button
                      onClick={() => openEditor({ ...s })}
                      className="text-xs px-3 py-1.5 rounded-lg border border-neutral-200 dark:border-neutral-700 text-neutral-600 dark:text-neutral-300 hover:bg-neutral-50 dark:hover:bg-neutral-800 transition-colors"
                    >
                      Editar
                    </button>
                    <button
                      onClick={() => del(s.id)}
                      disabled={deleting === s.id}
                      className="text-xs px-3 py-1.5 rounded-lg border border-red-200 dark:border-red-800 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors disabled:opacity-50"
                    >
                      {deleting === s.id ? '…' : 'Eliminar'}
                    </button>
                  </div>
                </div>

                {/* Env vars expandido */}
                {expandedEnv === s.id && envKeys.length > 0 && (
                  <div className="mt-3 pt-3 border-t border-neutral-100 dark:border-neutral-800">
                    <p className="text-xs text-neutral-400 mb-2">Variables de entorno configuradas:</p>
                    <div className="flex flex-wrap gap-2">
                      {envKeys.map(k => (
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

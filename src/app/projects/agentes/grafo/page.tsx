'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import AgentesNav from '@/components/agentes/AgentesNav';
import { delegateTargetId, isDelegateTool } from '@/lib/agentes';

type Agent = { id: string; name: string; enabled?: boolean; model?: string | null };
type Tool = { id: string; name: string; url?: string | null; enabled?: boolean };
type Edge = { parentId: string; childId: string; toolName: string; toolEnabled: boolean };

export default function GrafoPage() {
  const [agents, setAgents] = useState<Agent[]>([]);
  const [edges, setEdges] = useState<Edge[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [agentsRes, toolsRes] = await Promise.all([
          fetch('/api/agentes/v1/agents').then(r => r.json()),
          fetch('/api/agentes/v1/http-tools').then(r => r.json()),
        ]);
        const agentList: Agent[] = Array.isArray(agentsRes) ? agentsRes : [];
        const tools: Tool[] = Array.isArray(toolsRes) ? toolsRes : [];
        // Mapa toolId → {childId, name, enabled} solo de delegaciones.
        const delegateById = new Map<string, { childId: string; name: string; enabled: boolean }>();
        for (const t of tools) {
          if (!isDelegateTool(t)) continue;
          const childId = delegateTargetId(t.url);
          if (childId) delegateById.set(t.id, { childId, name: t.name, enabled: t.enabled ?? true });
        }
        // Por cada agente, sus tools asignadas → aristas padre→hijo.
        const assigned = await Promise.all(
          agentList.map(a =>
            fetch(`/api/agentes/v1/agents/${a.id}/http-tools`)
              .then(r => (r.ok ? r.json() : []))
              .then((ts: Tool[]) => ({ parentId: a.id, tools: Array.isArray(ts) ? ts : [] }))
              .catch(() => ({ parentId: a.id, tools: [] as Tool[] })),
          ),
        );
        const built: Edge[] = [];
        for (const { parentId, tools: ts } of assigned) {
          for (const t of ts) {
            const d = delegateById.get(t.id);
            if (d) built.push({ parentId, childId: d.childId, toolName: d.name, toolEnabled: d.enabled });
          }
        }
        if (!cancelled) { setAgents(agentList); setEdges(built); }
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : String(e));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const byId = useMemo(() => new Map(agents.map(a => [a.id, a])), [agents]);
  const childIds = useMemo(() => new Set(edges.map(e => e.childId)), [edges]);
  const parentIds = useMemo(() => new Set(edges.map(e => e.parentId)), [edges]);

  // Agrupa aristas por padre.
  const groups = useMemo(() => {
    const m = new Map<string, Edge[]>();
    for (const e of edges) {
      if (!m.has(e.parentId)) m.set(e.parentId, []);
      m.get(e.parentId)!.push(e);
    }
    // Ordena: padres que NO son hijos de nadie primero (raíces).
    return [...m.entries()].sort(([a], [b]) => {
      const ra = childIds.has(a) ? 1 : 0;
      const rb = childIds.has(b) ? 1 : 0;
      if (ra !== rb) return ra - rb;
      return (byId.get(a)?.name ?? '').localeCompare(byId.get(b)?.name ?? '');
    });
  }, [edges, childIds, byId]);

  // Agentes aislados (ni delegan ni son delegados).
  const isolated = useMemo(
    () => agents.filter(a => !parentIds.has(a.id) && !childIds.has(a.id)),
    [agents, parentIds, childIds],
  );

  const AgentChip = ({ id, role }: { id: string; role: 'parent' | 'child' }) => {
    const a = byId.get(id);
    const name = a?.name ?? id.slice(0, 8) + '…';
    return (
      <Link
        href={`/projects/agentes/${id}`}
        className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-sm font-medium transition-colors ${
          role === 'parent'
            ? 'border-[#71BF44] bg-[#71BF44]/10 text-[#5ea832] dark:text-[#71BF44] hover:bg-[#71BF44]/20'
            : 'border-neutral-200 dark:border-neutral-700 bg-white dark:bg-[#131313] text-neutral-800 dark:text-neutral-200 hover:border-[#71BF44]/50'
        }`}
      >
        {role === 'child' && <span>🤝</span>}
        {name}
        {a && a.enabled === false && (
          <span className="text-[10px] px-1 py-0.5 rounded bg-neutral-100 dark:bg-neutral-800 text-neutral-500">inactivo</span>
        )}
      </Link>
    );
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
        <h2 className="text-2xl font-bold text-neutral-900 dark:text-[#e5e5e5] tracking-tight">Agentes IA</h2>
        <p className="text-sm text-neutral-500 dark:text-[#ababab] mt-1">
          Grafo de delegaciones — qué agente puede invocar a qué subagente.
        </p>
      </header>

      <AgentesNav />

      {loading ? (
        <div className="py-20 text-center text-sm text-neutral-400">Cargando grafo…</div>
      ) : error ? (
        <p className="text-sm text-red-500 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg px-4 py-2">{error}</p>
      ) : (
        <div className="space-y-6">
          {/* Métricas */}
          <div className="flex flex-wrap gap-3">
            {[
              { label: 'Agentes', value: agents.length },
              { label: 'Delegaciones', value: edges.length },
              { label: 'Con subagentes', value: groups.length },
              { label: 'Subagentes', value: childIds.size },
            ].map(s => (
              <div key={s.label} className="bg-white dark:bg-[#131313] border border-neutral-200 dark:border-neutral-800 rounded-xl px-4 py-3 min-w-[120px]">
                <div className="text-2xl font-bold text-neutral-900 dark:text-white">{s.value}</div>
                <div className="text-xs text-neutral-400">{s.label}</div>
              </div>
            ))}
          </div>

          {groups.length === 0 ? (
            <div className="py-12 text-center">
              <p className="text-sm text-neutral-500 dark:text-neutral-400">Todavía no hay delegaciones configuradas.</p>
              <Link href="/projects/agentes/herramientas" className="text-sm text-[#71BF44] hover:underline mt-2 inline-block">
                Crear una delegación →
              </Link>
            </div>
          ) : (
            <div className="space-y-3">
              {groups.map(([parentId, es]) => (
                <div key={parentId} className="bg-white dark:bg-[#131313] border border-neutral-200 dark:border-neutral-800 rounded-xl p-5">
                  <div className="flex items-start gap-4">
                    {/* Padre */}
                    <div className="shrink-0 pt-1">
                      <AgentChip id={parentId} role="parent" />
                      {!childIds.has(parentId) && (
                        <div className="text-[10px] text-neutral-400 mt-1 text-center">raíz</div>
                      )}
                    </div>
                    {/* Flecha */}
                    <div className="shrink-0 self-center text-neutral-300 dark:text-neutral-600 text-xl">→</div>
                    {/* Hijos */}
                    <div className="flex flex-wrap gap-2 flex-1">
                      {es.map((e, i) => (
                        <div key={i} className="flex flex-col gap-0.5">
                          <AgentChip id={e.childId} role="child" />
                          <code className="text-[10px] text-neutral-400 px-1 truncate max-w-[180px]">
                            {e.toolName}{!e.toolEnabled && ' · inactiva'}
                          </code>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Aislados */}
          {isolated.length > 0 && (
            <div className="bg-white dark:bg-[#131313] border border-neutral-200 dark:border-neutral-800 rounded-xl p-5">
              <h3 className="text-sm font-semibold text-neutral-700 dark:text-neutral-300 mb-3">
                Sin conexiones <span className="text-neutral-400 font-normal">({isolated.length})</span>
              </h3>
              <div className="flex flex-wrap gap-2">
                {isolated.map(a => <AgentChip key={a.id} id={a.id} role="child" />)}
              </div>
            </div>
          )}
        </div>
      )}
    </>
  );
}

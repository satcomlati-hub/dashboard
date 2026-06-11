'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';

type Agent = {
  id: string;
  name: string;
  description?: string | null;
  identity?: string | null;
  model?: string | null;
  enabled?: boolean;
};

type Filter = 'todos' | 'principales' | 'subagentes' | 'activos' | 'inactivos';

const FILTERS: { key: Filter; label: string }[] = [
  { key: 'todos', label: 'Todos' },
  { key: 'principales', label: 'Principales' },
  { key: 'subagentes', label: 'Subagentes' },
  { key: 'activos', label: 'Activos' },
  { key: 'inactivos', label: 'Inactivos' },
];

export default function AgentsGrid({
  agents,
  subagentIds,
}: {
  agents: Agent[];
  subagentIds: string[];
}) {
  const [q, setQ] = useState('');
  const [filter, setFilter] = useState<Filter>('todos');
  const subset = useMemo(() => new Set(subagentIds), [subagentIds]);

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return agents.filter(a => {
      const isSub = subset.has(a.id);
      if (filter === 'principales' && isSub) return false;
      if (filter === 'subagentes' && !isSub) return false;
      if (filter === 'activos' && !a.enabled) return false;
      if (filter === 'inactivos' && a.enabled) return false;
      if (!needle) return true;
      const hay = `${a.name} ${a.description ?? ''} ${a.identity ?? ''} ${a.model ?? ''}`.toLowerCase();
      return hay.includes(needle);
    });
  }, [agents, subset, q, filter]);

  const count = (f: Filter) => {
    if (f === 'todos') return agents.length;
    if (f === 'principales') return agents.filter(a => !subset.has(a.id)).length;
    if (f === 'subagentes') return agents.filter(a => subset.has(a.id)).length;
    if (f === 'activos') return agents.filter(a => a.enabled).length;
    return agents.filter(a => !a.enabled).length;
  };

  return (
    <>
      {/* Controles */}
      <div className="flex flex-wrap items-center gap-3 mb-5">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <svg className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            value={q}
            onChange={e => setQ(e.target.value)}
            placeholder="Buscar por nombre, modelo o descripción…"
            className="w-full pl-9 pr-3 py-2 text-sm bg-white dark:bg-[#131313] border border-neutral-200 dark:border-neutral-800 rounded-lg text-neutral-900 dark:text-white focus:outline-none focus:border-[#71BF44]"
          />
        </div>
        <div className="flex gap-1 bg-neutral-100 dark:bg-neutral-900 rounded-lg p-1">
          {FILTERS.map(f => (
            <button
              key={f.key}
              onClick={() => setFilter(f.key)}
              className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                filter === f.key
                  ? 'bg-white dark:bg-[#1e1e1e] shadow-sm text-neutral-900 dark:text-white'
                  : 'text-neutral-500 dark:text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200'
              }`}
            >
              {f.label} <span className="text-neutral-400">{count(f.key)}</span>
            </button>
          ))}
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="py-16 text-center text-sm text-neutral-400">
          Ningún agente coincide con la búsqueda.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filtered.map(agent => (
            <Link
              key={agent.id}
              href={`/projects/agentes/${agent.id}`}
              className="group bg-white dark:bg-[#131313] border border-neutral-200 dark:border-neutral-800 rounded-xl p-6 shadow-sm hover:border-[#71BF44] transition-all"
            >
              <div className="flex items-start justify-between mb-3">
                <div className="w-10 h-10 rounded-lg bg-[#71BF44]/10 flex items-center justify-center group-hover:bg-[#71BF44]/20 transition-colors">
                  <svg className="w-5 h-5 text-[#71BF44]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                  </svg>
                </div>
                <div className="flex items-center gap-1.5">
                  {subset.has(agent.id) && (
                    <span className="text-[10px] px-2 py-0.5 rounded-full font-medium bg-[#71BF44]/15 text-[#5ea832] dark:text-[#71BF44]" title="Otro agente delega en este">
                      Subagente
                    </span>
                  )}
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                    agent.enabled
                      ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400'
                      : 'bg-neutral-100 dark:bg-neutral-800 text-neutral-500'
                  }`}>
                    {agent.enabled ? 'Activo' : 'Inactivo'}
                  </span>
                </div>
              </div>
              <h3 className="text-base font-bold text-neutral-900 dark:text-white mb-1">{agent.name}</h3>
              <p className="text-xs text-neutral-500 dark:text-neutral-400 line-clamp-2 mb-3">
                {agent.description ?? agent.identity}
              </p>
              <div className="flex items-center gap-3 text-xs text-neutral-400">
                <span className="flex items-center gap-1">
                  <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 3H5a2 2 0 00-2 2v4m6-6h10a2 2 0 012 2v4M9 3v18m0 0h10a2 2 0 002-2V9M9 21H5a2 2 0 01-2-2V9m0 0h18" />
                  </svg>
                  {agent.model ?? 'gemini-3.5-flash'}
                </span>
              </div>
            </Link>
          ))}
        </div>
      )}
    </>
  );
}

'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';

interface Rule {
  id: number;
  nombre: string;
  ambiente: string;
  prioridad_ticket: string;
  esta_activa: boolean;
}

export default function MonitoreoRulesWidget() {
  const [rules, setRules] = useState<Rule[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/db/monitoreo-rules')
      .then((r) => r.json())
      .then((j) => setRules(j.data || []))
      .catch((e) => console.error(e))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="bg-white dark:bg-[#131313] border border-neutral-200 dark:border-neutral-800 rounded-xl shadow-xs p-6 h-[300px] flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-[#71BF44]/20 border-t-[#71BF44] rounded-full animate-spin" />
      </div>
    );
  }

  const getPriorityStyle = (priority: string) => {
    switch (priority?.toLowerCase()) {
      case 'alta':
      case 'high':
      case 'critical':
        return 'bg-red-500/10 text-red-600 dark:text-red-400';
      case 'media':
      case 'medium':
        return 'bg-amber-500/10 text-amber-600 dark:text-amber-400';
      default:
        return 'bg-blue-500/10 text-blue-600 dark:text-blue-400';
    }
  };

  return (
    <div className="bg-white dark:bg-[#131313] border border-neutral-200 dark:border-neutral-800 rounded-xl overflow-hidden shadow-xs flex flex-col h-[300px]">
      {/* Header */}
      <div className="px-5 py-3.5 border-b border-neutral-200 dark:border-neutral-800 flex justify-between items-center shrink-0">
        <div className="flex items-center gap-2">
          <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" className="text-[#71BF44]">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
          </svg>
          <h2 className="text-sm font-semibold text-neutral-900 dark:text-white">Reglas de Monitoreo</h2>
        </div>
        <Link href="/settings" className="text-xs text-[#71BF44] hover:underline font-medium">
          Config &rarr;
        </Link>
      </div>

      {/* List */}
      <div className="flex-1 overflow-y-auto min-h-0">
        <div className="divide-y divide-neutral-100 dark:divide-neutral-800/40">
          {rules.slice(0, 8).map((rule) => (
            <div 
              key={rule.id} 
              className="px-4 py-3 flex items-center justify-between hover:bg-neutral-50/50 dark:hover:bg-neutral-850/20 transition-colors"
            >
              <div className="flex-1 min-w-0 pr-2">
                <p className="text-xs font-semibold text-neutral-800 dark:text-neutral-200 truncate">
                  {rule.nombre}
                </p>
                <div className="flex items-center gap-1.5 mt-1">
                  <span className="text-[9px] text-neutral-400 dark:text-neutral-500 font-mono">
                    {rule.ambiente}
                  </span>
                  <span className="text-neutral-300 dark:text-neutral-700 text-[8px]">•</span>
                  <span className={`px-1.5 py-0.2 rounded text-[8px] font-bold uppercase ${getPriorityStyle(rule.prioridad_ticket)}`}>
                    {rule.prioridad_ticket}
                  </span>
                </div>
              </div>

              <div className="shrink-0 flex items-center gap-1.5">
                <span className={`w-1.5 h-1.5 rounded-full ${rule.esta_activa ? 'bg-[#71BF44]' : 'bg-neutral-300 dark:bg-neutral-700'}`} />
                <span className={`text-[10px] font-medium ${rule.esta_activa ? 'text-[#71BF44]' : 'text-neutral-400'}`}>
                  {rule.esta_activa ? 'Activa' : 'Pausa'}
                </span>
              </div>
            </div>
          ))}

          {rules.length === 0 && (
            <div className="py-12 text-center text-neutral-400 italic text-xs">
              No hay reglas de alertas configuradas
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

'use client';

import React, { useState, useEffect } from 'react';

interface Metrics {
  totalExecutions: number;
  activeWorkflows: number;
  instances: { n8n: number; sara: number };
}

export default function WorkflowStatsWidget() {
  const [metrics, setMetrics] = useState<Metrics | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/metrics')
      .then((r) => r.json())
      .then((j) => setMetrics(j))
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

  const executions = metrics?.totalExecutions ?? 0;
  const planLimit = 2500; // Plan Starter n8n Cloud
  const pctUsed = Math.min(100, Math.max(0, (executions / planLimit) * 100));

  const getLimitColor = (pct: number) => {
    if (pct > 90) return 'bg-red-500';
    if (pct > 70) return 'bg-amber-500';
    return 'bg-[#71BF44]';
  };

  return (
    <div className="bg-white dark:bg-[#131313] border border-neutral-200 dark:border-neutral-800 rounded-xl p-5 shadow-xs flex flex-col h-[300px]">
      <h3 className="text-xs font-semibold text-neutral-400 dark:text-neutral-500 uppercase tracking-wide mb-4">
        Estadísticas de n8n
      </h3>

      {/* Monthly executions usage */}
      <div className="space-y-2 mb-6">
        <div className="flex justify-between items-center text-xs">
          <span className="font-semibold text-neutral-700 dark:text-neutral-300">Ejecuciones de Workflows</span>
          <span className="font-mono text-neutral-500">{executions.toLocaleString()} / {planLimit.toLocaleString()}</span>
        </div>
        <div className="h-2 bg-neutral-100 dark:bg-neutral-800 rounded-full overflow-hidden">
          <div 
            className={`h-full rounded-full transition-all duration-500 ${getLimitColor(pctUsed)}`} 
            style={{ width: `${Math.max(pctUsed, 1)}%` }} 
          />
        </div>
        <div className="flex justify-between text-[9px] text-neutral-400">
          <span>{pctUsed.toFixed(1)}% utilizado</span>
          <span>{(planLimit - executions).toLocaleString()} libres</span>
        </div>
      </div>

      {/* Active count breakdown */}
      <div className="grid grid-cols-2 gap-3 mt-2">
        <div className="bg-neutral-50 dark:bg-neutral-900/40 p-3 rounded-lg border border-neutral-150 dark:border-neutral-800 text-center">
          <p className="text-[9px] uppercase font-bold text-neutral-400">Cloud Activos</p>
          <p className="text-xl font-extrabold text-neutral-800 dark:text-neutral-200 mt-1">
            {metrics?.instances.n8n ?? 0}
          </p>
        </div>

        <div className="bg-neutral-50 dark:bg-neutral-900/40 p-3 rounded-lg border border-neutral-150 dark:border-neutral-800 text-center">
          <p className="text-[9px] uppercase font-bold text-neutral-400">SARA Activos</p>
          <p className="text-xl font-extrabold text-neutral-800 dark:text-neutral-200 mt-1">
            {metrics?.instances.sara ?? 0}
          </p>
        </div>
      </div>
    </div>
  );
}

'use client';
import { useState, useEffect } from 'react';

export default function TopCards() {
  const [metrics, setMetrics] = useState({
    totalExecutions: 0,
    activeWorkflows: 0,
    geminiTokens: 0,
    instances: { n8n: 0, sara: 0 }
  });

  useEffect(() => {
    fetch('/api/metrics')
      .then(res => res.json())
      .then(data => {
        if (!data.error) setMetrics(data);
      })
      .catch(err => console.error('Fetch error:', err));
  }, []);

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
      <div className="bg-white dark:bg-[#131313] border border-neutral-200 dark:border-neutral-800 rounded-xl p-6 shadow-sm">
        <h3 className="text-sm font-medium text-neutral-500 dark:text-neutral-400 mb-1">Ejecuciones Totales</h3>
        <p className="text-3xl font-bold text-neutral-900 dark:text-white">
          {metrics.totalExecutions.toLocaleString()}{metrics.totalExecutions >= 100 ? '+' : ''}
        </p>
        <div className="mt-2 text-sm text-[#71BF44] flex items-center gap-1 font-medium">
          <svg width="16" height="16" className="w-4 h-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 10l7-7m0 0l7 7m-7-7v18" />
          </svg>
          Sincronizado
        </div>
      </div>

      <div className="bg-white dark:bg-[#131313] border border-neutral-200 dark:border-neutral-800 rounded-xl p-6 shadow-sm">
        <h3 className="text-sm font-medium text-neutral-500 dark:text-neutral-400 mb-1">Workflows Activos</h3>
        <p className="text-3xl font-bold text-neutral-900 dark:text-white">{metrics.activeWorkflows}</p>
        <div className="mt-2 text-sm text-neutral-500 dark:text-neutral-400 flex items-center gap-1">
          <span>n8n: {metrics.instances.n8n}</span> <span className="mx-1">•</span> <span>SARA: {metrics.instances.sara}</span>
        </div>
      </div>

      <div className="bg-white dark:bg-[#131313] border border-neutral-200 dark:border-neutral-800 rounded-xl p-6 shadow-sm">
        <h3 className="text-sm font-medium text-neutral-500 dark:text-neutral-400 mb-1">Consumo Gemini (Tokens)</h3>
        <p className="text-3xl font-bold text-neutral-900 dark:text-white">{(metrics.geminiTokens / 1000).toFixed(1)}k</p>
        <div className="mt-2 text-sm text-[#71BF44] flex items-center gap-1 font-medium">
          {metrics.geminiTokens > 0 ? 'Métricas en tiempo real' : 'Esperando datos...'}
        </div>
      </div>

      <div className="bg-white dark:bg-[#131313] border border-neutral-200 dark:border-neutral-800 rounded-xl p-6 shadow-sm">
        <h3 className="text-sm font-medium text-neutral-500 dark:text-neutral-400 mb-1">Estado Conexión</h3>
        <p className="text-3xl font-bold text-neutral-900 dark:text-white">2/2</p>
        <div className="mt-2 text-sm text-neutral-500 dark:text-neutral-400 flex items-center gap-1">
          Instancias conectadas
        </div>
      </div>
    </div>
  );
}

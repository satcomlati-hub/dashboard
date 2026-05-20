'use client';

import React, { useState, useEffect } from 'react';

interface Metrics {
  instances: { n8n: number; sara: number };
  connection: { sara: boolean; primary: boolean; connected: number; total: number };
}

interface UsageData {
  infra?: {
    supabase: {
      dbMb: number;
    };
  };
}

export default function SystemHealthWidget() {
  const [metrics, setMetrics] = useState<Metrics | null>(null);
  const [usage, setUsage] = useState<UsageData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      fetch('/api/metrics').then(r => r.json()),
      fetch('/api/usage?range=7d').then(r => r.json())
    ])
      .then(([metricsData, usageData]) => {
        setMetrics(metricsData);
        setUsage(usageData);
      })
      .catch(e => console.error('Error fetching health metrics:', e))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="bg-white dark:bg-[#131313] border border-neutral-200 dark:border-neutral-800 rounded-xl shadow-xs p-6 h-[300px] flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-[#71BF44]/20 border-t-[#71BF44] rounded-full animate-spin" />
      </div>
    );
  }

  const dbMb = usage?.infra?.supabase?.dbMb ?? 0;
  const dbMaxMb = 8192; // 8GB Pro limits
  const dbPct = Math.min(100, Math.max(0, (dbMb / dbMaxMb) * 100));
  
  const getDbColor = (pct: number) => {
    if (pct > 85) return 'bg-red-500';
    if (pct > 65) return 'bg-amber-500';
    return 'bg-[#71BF44]';
  };

  const primaryOnline = metrics?.connection?.primary ?? false;
  const saraOnline = metrics?.connection?.sara ?? false;

  return (
    <div className="bg-white dark:bg-[#131313] border border-neutral-200 dark:border-neutral-800 rounded-xl p-5 shadow-xs flex flex-col h-[300px]">
      <h3 className="text-xs font-semibold text-neutral-400 dark:text-neutral-500 uppercase tracking-wide mb-4">
        Salud de la Infraestructura
      </h3>

      {/* Supabase status */}
      <div className="space-y-2 mb-6">
        <div className="flex justify-between items-center text-xs">
          <div className="flex items-center gap-1.5 font-medium text-neutral-700 dark:text-neutral-300">
            <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" className="text-[#58d6f6]">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M4 7v10c0 2.21 3.58 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.58 4 8 4s8-1.79 8-4M4 7c0-2.21 3.58-4 8-4s8 1.79 8 4m0 5c0 2.21-3.58 4-8 4s-8-1.79-8-4" />
            </svg>
            Supabase DB
          </div>
          <span className="font-mono text-neutral-500">{dbMb.toFixed(1)} MB / 8 GB</span>
        </div>
        <div className="h-2 bg-neutral-100 dark:bg-neutral-800 rounded-full overflow-hidden">
          <div 
            className={`h-full rounded-full transition-all duration-500 ${getDbColor(dbPct)}`} 
            style={{ width: `${Math.max(dbPct, 1)}%` }} 
          />
        </div>
        <p className="text-[10px] text-neutral-400 dark:text-neutral-500">
          Utilizando el {dbPct.toFixed(1)}% de la cuota de base de datos.
        </p>
      </div>

      {/* Server online connections */}
      <div className="flex-1 flex flex-col justify-center space-y-4">
        {/* Primary Server */}
        <div className="flex items-center justify-between p-2.5 rounded-lg bg-neutral-50 dark:bg-neutral-900/40 border border-neutral-150 dark:border-neutral-800">
          <span className="text-xs font-semibold text-neutral-700 dark:text-neutral-300">n8n Cloud (Primary)</span>
          <div className="flex items-center gap-1.5">
            <span className={`w-2 h-2 rounded-full ${primaryOnline ? 'bg-[#71BF44]' : 'bg-red-500'}`} />
            <span className={`text-[10px] font-bold uppercase tracking-wider ${primaryOnline ? 'text-[#71BF44]' : 'text-red-500'}`}>
              {primaryOnline ? 'Online' : 'Offline'}
            </span>
          </div>
        </div>

        {/* SARA Server */}
        <div className="flex items-center justify-between p-2.5 rounded-lg bg-neutral-50 dark:bg-neutral-900/40 border border-neutral-150 dark:border-neutral-800">
          <span className="text-xs font-semibold text-neutral-700 dark:text-neutral-300">SARA API Node</span>
          <div className="flex items-center gap-1.5">
            <span className={`w-2 h-2 rounded-full ${saraOnline ? 'bg-[#71BF44]' : 'bg-red-500'}`} />
            <span className={`text-[10px] font-bold uppercase tracking-wider ${saraOnline ? 'text-[#71BF44]' : 'text-red-500'}`}>
              {saraOnline ? 'Online' : 'Offline'}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

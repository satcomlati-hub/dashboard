'use client';

import React, { useState, useEffect } from 'react';
import { formatDate } from '@/lib/formatters';

interface LogItem {
  fecha_ecuador: string;
  key: string;
  num_eventos: number;
  pais: string;
  detalle_evento: string;
}

export default function RecentLogsWidget() {
  const [logs, setLogs] = useState<LogItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/db/monitoreo?limit=5')
      .then((r) => r.json())
      .then((j) => setLogs(j.data || []))
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

  return (
    <div className="bg-white dark:bg-[#131313] border border-neutral-200 dark:border-neutral-800 rounded-xl overflow-hidden shadow-xs flex flex-col h-[300px]">
      {/* Header */}
      <div className="px-5 py-3.5 border-b border-neutral-200 dark:border-neutral-800 flex justify-between items-center shrink-0">
        <div className="flex items-center gap-2">
          <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" className="text-red-500">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
          <h2 className="text-sm font-semibold text-neutral-900 dark:text-white">Bitácora Rápida (Alarmas)</h2>
        </div>
        <span className="text-[10px] bg-red-500/10 text-red-500 font-bold px-2 py-0.5 rounded-full">
          Desconexiones
        </span>
      </div>

      {/* Log Feed */}
      <div className="flex-1 overflow-y-auto min-h-0 divide-y divide-neutral-100 dark:divide-neutral-850/40">
        {logs.map((log, idx) => (
          <div key={idx} className="p-3.5 hover:bg-neutral-50/50 dark:hover:bg-neutral-850/10 transition-all">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-mono text-neutral-500">
                {formatDate(log.fecha_ecuador, true)}
              </span>
              <span className="text-[9px] bg-neutral-100 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 text-neutral-500 rounded px-1.5 py-0.2">
                {log.pais}
              </span>
            </div>
            <p className="text-xs font-semibold text-neutral-800 dark:text-neutral-200 mt-1 truncate">
              {log.key}
            </p>
            <p className="text-[10px] text-neutral-400 dark:text-neutral-500 mt-0.5 truncate">
              {log.detalle_evento}
            </p>
          </div>
        ))}

        {logs.length === 0 && (
          <div className="py-12 text-center text-neutral-400 italic text-xs">
            Sin alarmas registradas recientemente
          </div>
        )}
      </div>
    </div>
  );
}

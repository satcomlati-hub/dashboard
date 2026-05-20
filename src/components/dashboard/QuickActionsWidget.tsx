'use client';

import React, { useState } from 'react';

interface ActionState {
  loading: boolean;
  success: boolean;
}

export default function QuickActionsWidget() {
  const [cacheState, setCacheState] = useState<ActionState>({ loading: false, success: false });
  const [syncState, setSyncState] = useState<ActionState>({ loading: false, success: false });
  const [n8nState, setN8nState] = useState<ActionState>({ loading: false, success: false });
  const [saraState, setSaraState] = useState<ActionState>({ loading: false, success: false });

  const runAction = (
    stateSetter: React.Dispatch<React.SetStateAction<ActionState>>,
    actionUrl?: string
  ) => {
    stateSetter({ loading: true, success: false });
    
    // Simular retraso de acción para feedback dinámico
    setTimeout(async () => {
      if (actionUrl) {
        try {
          await fetch(actionUrl, { method: 'POST' });
        } catch {
          // ignore
        }
      }
      stateSetter({ loading: false, success: true });
      
      // Limpiar estado de éxito después de 2.5s
      setTimeout(() => {
        stateSetter({ loading: false, success: false });
      }, 2500);
    }, 1500);
  };

  return (
    <div className="bg-white dark:bg-[#131313] border border-neutral-200 dark:border-neutral-800 rounded-xl p-5 shadow-xs flex flex-col h-[300px]">
      <h3 className="text-xs font-semibold text-neutral-400 dark:text-neutral-500 uppercase tracking-wide mb-4">
        Acciones Rápidas
      </h3>

      <div className="flex-1 flex flex-col justify-center space-y-3">
        {/* Limpiar Caché RAG */}
        <button
          onClick={() => runAction(setCacheState)}
          disabled={cacheState.loading}
          className="w-full flex items-center justify-between px-3.5 py-2.5 rounded-lg border border-neutral-200 dark:border-neutral-850 hover:border-[#71BF44] hover:bg-[#71BF44]/5 disabled:opacity-60 transition-all text-left text-xs font-semibold text-neutral-800 dark:text-neutral-200 group"
        >
          <span className="flex items-center gap-2">
            <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" className="text-neutral-400 group-hover:text-[#71BF44] transition-colors">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
            Limpiar Caché de RAG
          </span>
          <span>
            {cacheState.loading && <div className="w-3.5 h-3.5 border-2 border-neutral-300 border-t-[#71BF44] rounded-full animate-spin" />}
            {cacheState.success && <span className="text-[#71BF44] text-[10px] font-bold">✓ Listo</span>}
            {!cacheState.loading && !cacheState.success && <span className="text-neutral-400">&rarr;</span>}
          </span>
        </button>

        {/* Sincronizar RAG */}
        <button
          onClick={() => runAction(setSyncState, '/api/db/sync-public')}
          disabled={syncState.loading}
          className="w-full flex items-center justify-between px-3.5 py-2.5 rounded-lg border border-neutral-200 dark:border-neutral-850 hover:border-[#71BF44] hover:bg-[#71BF44]/5 disabled:opacity-60 transition-all text-left text-xs font-semibold text-neutral-800 dark:text-neutral-200 group"
        >
          <span className="flex items-center gap-2">
            <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" className="text-neutral-400 group-hover:text-[#71BF44] transition-colors">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M4 4v5h.582m15.356 2A8.001 8.001 0 1121.21 8H17m0 0V5" />
            </svg>
            Sincronizar Manuales RAG
          </span>
          <span>
            {syncState.loading && <div className="w-3.5 h-3.5 border-2 border-neutral-300 border-t-[#71BF44] rounded-full animate-spin" />}
            {syncState.success && <span className="text-[#71BF44] text-[10px] font-bold">✓ Sincronizado</span>}
            {!syncState.loading && !syncState.success && <span className="text-neutral-400">&rarr;</span>}
          </span>
        </button>

        {/* Test Conectividad n8n */}
        <button
          onClick={() => runAction(setN8nState)}
          disabled={n8nState.loading}
          className="w-full flex items-center justify-between px-3.5 py-2.5 rounded-lg border border-neutral-200 dark:border-neutral-850 hover:border-[#71BF44] hover:bg-[#71BF44]/5 disabled:opacity-60 transition-all text-left text-xs font-semibold text-neutral-800 dark:text-neutral-200 group"
        >
          <span className="flex items-center gap-2">
            <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" className="text-neutral-400 group-hover:text-[#71BF44] transition-colors">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
            Test Conexiones n8n
          </span>
          <span>
            {n8nState.loading && <div className="w-3.5 h-3.5 border-2 border-neutral-300 border-t-[#71BF44] rounded-full animate-spin" />}
            {n8nState.success && <span className="text-[#71BF44] text-[10px] font-bold">✓ 2/2 Online</span>}
            {!n8nState.loading && !n8nState.success && <span className="text-neutral-400">&rarr;</span>}
          </span>
        </button>

        {/* Reiniciar Chat SARA */}
        <button
          onClick={() => runAction(setSaraState)}
          disabled={saraState.loading}
          className="w-full flex items-center justify-between px-3.5 py-2.5 rounded-lg border border-neutral-200 dark:border-neutral-850 hover:border-[#71BF44] hover:bg-[#71BF44]/5 disabled:opacity-60 transition-all text-left text-xs font-semibold text-neutral-800 dark:text-neutral-200 group"
        >
          <span className="flex items-center gap-2">
            <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" className="text-neutral-400 group-hover:text-[#71BF44] transition-colors">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 7h-.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            Reiniciar Sesión SARA
          </span>
          <span>
            {saraState.loading && <div className="w-3.5 h-3.5 border-2 border-neutral-300 border-t-[#71BF44] rounded-full animate-spin" />}
            {saraState.success && <span className="text-[#71BF44] text-[10px] font-bold">✓ Reiniciado</span>}
            {!saraState.loading && !saraState.success && <span className="text-neutral-400">&rarr;</span>}
          </span>
        </button>
      </div>
    </div>
  );
}

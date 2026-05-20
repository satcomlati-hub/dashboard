'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';

interface Articulo {
  articulo: string;
  is_public: boolean;
  is_active: boolean;
}

interface ManualGroup {
  [manualName: string]: {
    articulos: Articulo[];
  };
}

export default function RagCollectionsWidget() {
  const [collections, setCollections] = useState<ManualGroup | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/db/rag-collections')
      .then((r) => r.json())
      .then((j) => setCollections(j))
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

  const manuals = collections ? Object.keys(collections) : [];
  const totalManuals = manuals.length;
  const totalArticulos = collections
    ? Object.values(collections).reduce((sum, g) => sum + g.articulos.length, 0)
    : 0;

  return (
    <div className="bg-white dark:bg-[#131313] border border-neutral-200 dark:border-neutral-800 rounded-xl overflow-hidden shadow-xs flex flex-col h-[300px]">
      {/* Header */}
      <div className="px-5 py-3.5 border-b border-neutral-200 dark:border-neutral-800 flex justify-between items-center shrink-0">
        <div className="flex items-center gap-2">
          <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" className="text-[#71BF44]">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
          </svg>
          <h2 className="text-sm font-semibold text-neutral-900 dark:text-white">Colecciones RAG</h2>
        </div>
        <Link href="/credentials" className="text-xs text-[#71BF44] hover:underline font-medium">
          Ingesta &rarr;
        </Link>
      </div>

      {/* Stats Summary */}
      <div className="grid grid-cols-2 border-b border-neutral-100 dark:border-neutral-800/60 shrink-0 text-center bg-neutral-50/50 dark:bg-neutral-950/20">
        <div className="py-2.5 border-r border-neutral-100 dark:border-neutral-800/60">
          <p className="text-[10px] uppercase font-bold text-neutral-400">Manuales</p>
          <p className="text-lg font-extrabold text-neutral-800 dark:text-neutral-200">{totalManuals}</p>
        </div>
        <div className="py-2.5">
          <p className="text-[10px] uppercase font-bold text-neutral-400">Artículos Indexados</p>
          <p className="text-lg font-extrabold text-neutral-800 dark:text-neutral-200">{totalArticulos}</p>
        </div>
      </div>

      {/* List */}
      <div className="flex-1 overflow-y-auto min-h-0">
        <table className="w-full text-xs text-left">
          <thead className="text-[10px] uppercase text-neutral-400 bg-neutral-50 dark:bg-neutral-900/40 sticky top-0">
            <tr>
              <th className="px-4 py-2">Manual / Documento</th>
              <th className="px-4 py-2 text-center">Artículos</th>
              <th className="px-4 py-2 text-right">Estatus</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-150 dark:divide-neutral-800/40">
            {manuals.slice(0, 10).map((manualName) => {
              const info = collections![manualName];
              const articulosCount = info.articulos.length;
              const hasPublic = info.articulos.some((a) => a.is_public);
              
              return (
                <tr key={manualName} className="hover:bg-neutral-50/50 dark:hover:bg-neutral-800/20 transition-colors">
                  <td className="px-4 py-2.5 font-medium text-neutral-900 dark:text-neutral-200 max-w-[180px] truncate" title={manualName}>
                    {manualName}
                  </td>
                  <td className="px-4 py-2.5 text-center font-mono font-bold text-neutral-600 dark:text-neutral-400">
                    {articulosCount}
                  </td>
                  <td className="px-4 py-2.5 text-right">
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[9px] font-semibold ${
                      hasPublic
                        ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
                        : 'bg-neutral-100 text-neutral-600 dark:bg-neutral-800 dark:text-neutral-400'
                    }`}>
                      {hasPublic ? 'Público' : 'Privado'}
                    </span>
                  </td>
                </tr>
              );
            })}
            {manuals.length === 0 && (
              <tr>
                <td colSpan={3} className="py-8 text-center text-neutral-400 italic">No hay colecciones indexadas</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

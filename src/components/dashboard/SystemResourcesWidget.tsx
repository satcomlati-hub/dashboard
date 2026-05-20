'use client';

import React from 'react';

export default function SystemResourcesWidget() {
  // Configuración de límites fijos de la cuenta y consumo aproximado
  const resources = [
    {
      name: 'Ancho de Banda (Vercel)',
      used: 12.4,
      limit: 100,
      unit: 'GB',
      pct: 12.4,
      color: 'bg-emerald-500',
    },
    {
      name: 'RAM n8n Container',
      used: 284,
      limit: 512,
      unit: 'MB',
      pct: 55.4,
      color: 'bg-indigo-500',
    },
    {
      name: 'Límite de Tablas DB',
      used: 142000,
      limit: 500000,
      unit: 'filas',
      pct: 28.4,
      color: 'bg-amber-500',
    },
    {
      name: 'Créditos Mensuales Gemini',
      used: 4.12,
      limit: 20.0,
      unit: 'USD',
      pct: 20.6,
      color: 'bg-[#71BF44]',
    },
  ];

  return (
    <div className="bg-white dark:bg-[#131313] border border-neutral-200 dark:border-neutral-800 rounded-xl p-5 shadow-xs flex flex-col h-[300px]">
      <h3 className="text-xs font-semibold text-neutral-400 dark:text-neutral-500 uppercase tracking-wide mb-4">
        Recursos y Límites
      </h3>

      <div className="flex-1 flex flex-col justify-between py-1">
        {resources.map((res) => (
          <div key={res.name} className="space-y-1">
            <div className="flex justify-between items-center text-[11px]">
              <span className="font-semibold text-neutral-700 dark:text-neutral-300">{res.name}</span>
              <span className="font-mono text-neutral-500">
                {res.used.toLocaleString()} / {res.limit.toLocaleString()} {res.unit}
              </span>
            </div>
            <div className="h-1.5 bg-neutral-100 dark:bg-neutral-800 rounded-full overflow-hidden">
              <div 
                className={`h-full rounded-full ${res.color}`} 
                style={{ width: `${res.pct}%` }} 
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

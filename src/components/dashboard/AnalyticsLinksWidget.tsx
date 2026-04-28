'use client';

import Link from 'next/link';

const ANALYTICS_SECTIONS = [
  {
    id: 'monitoreo',
    name: 'Monitoreo Eventos',
    href: '/analytics/monitoreo',
    color: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400',
    dot: 'bg-emerald-500',
  },
  {
    id: 'rabbit',
    name: 'Rabbit MQ',
    href: '/analytics/rabbit',
    color: 'bg-purple-500/10 text-purple-600 dark:text-purple-400',
    dot: 'bg-purple-500',
  },
  {
    id: 'unauthorized',
    name: 'No Autorizados',
    href: '/analytics/unauthorized',
    color: 'bg-red-500/10 text-red-600 dark:text-red-400',
    dot: 'bg-red-500',
  },
  {
    id: 'pendientes',
    name: 'Pendientes',
    href: '/analytics/pendientes-reporte',
    color: 'bg-amber-500/10 text-amber-600 dark:text-amber-400',
    dot: 'bg-amber-500',
  },
  {
    id: 'eventos',
    name: 'Historial Eventos',
    href: '/analytics/eventos',
    color: 'bg-blue-500/10 text-blue-600 dark:text-blue-400',
    dot: 'bg-blue-500',
  },
];

export default function AnalyticsLinksWidget() {
  return (
    <div className="bg-white dark:bg-[#131313] border border-neutral-200 dark:border-neutral-800 rounded-xl p-4 shadow-sm">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-neutral-900 dark:text-white">Analytics</h3>
        <Link href="/analytics" className="text-xs text-[#71BF44] hover:underline font-medium">
          Ver todos →
        </Link>
      </div>
      <div className="flex flex-col gap-1.5">
        {ANALYTICS_SECTIONS.map(section => (
          <Link
            key={section.id}
            href={section.href}
            className="flex items-center gap-2.5 px-3 py-2 rounded-lg hover:bg-neutral-50 dark:hover:bg-neutral-800/50 transition-colors group"
          >
            <span className={`w-2 h-2 rounded-full flex-shrink-0 ${section.dot}`} />
            <span className="text-xs font-medium text-neutral-700 dark:text-neutral-300 group-hover:text-neutral-900 dark:group-hover:text-white transition-colors">
              {section.name}
            </span>
          </Link>
        ))}
      </div>
    </div>
  );
}

import Link from 'next/link';

export default function AnalyticsPage() {
  const subsections = [
    {
      id: 'monitoreo',
      name: 'Monitoreo de Eventos',
      description: 'Bitácora técnica de eventos, conteo de ejecuciones y detalles por país.',
      href: '/analytics/monitoreo',
      icon: (
        <svg className="w-6 h-6 text-[#71BF44]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
        </svg>
      )
    }
  ];

  return (
    <>
      <header className="mb-8">
        <h2 className="text-2xl font-bold text-neutral-900 dark:text-[#e5e5e5] tracking-tight">Satcom Analytics</h2>
        <p className="text-sm text-neutral-500 dark:text-[#ababab] mt-1">Dashboards directos desde las bases de datos de Satcom.</p>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {subsections.map((section) => (
          <Link 
            key={section.id} 
            href={section.href}
            className="group bg-white dark:bg-[#131313] border border-neutral-200 dark:border-neutral-800 rounded-xl p-6 shadow-sm hover:border-[#71BF44] transition-all"
          >
            <div className="w-12 h-12 rounded-lg bg-[#71BF44]/10 flex items-center justify-center mb-4 group-hover:bg-[#71BF44]/20 transition-colors">
              {section.icon}
            </div>
            <h3 className="text-lg font-bold text-neutral-900 dark:text-white mb-2">{section.name}</h3>
            <p className="text-sm text-neutral-500 dark:text-neutral-400">
              {section.description}
            </p>
          </Link>
        ))}
        
        {/* Placeholder for future analytic sections */}
        <div className="bg-neutral-50 dark:bg-[#0a0a0a] border border-dashed border-neutral-200 dark:border-neutral-800 rounded-xl p-6 flex flex-col items-center justify-center text-center opacity-60">
          <p className="text-sm font-medium text-neutral-400">Próximos Paneles...</p>
        </div>
      </div>
    </>
  );
}

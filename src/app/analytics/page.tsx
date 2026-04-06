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
    },
    {
      id: 'rabbit',
      name: 'Monitoreo Rabbit',
      description: 'Estado en tiempo real de colas RabbitMQ por ambiente con alertas por severidad.',
      href: '/analytics/rabbit',
      icon: (
        <svg className="w-6 h-6 text-[#71BF44]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 12h14M5 12a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v4a2 2 0 01-2 2M5 12a2 2 0 00-2 2v4a2 2 0 002 2h14a2 2 0 002-2v-4a2 2 0 00-2-2m-2-4h.01M17 16h.01" />
        </svg>
      )
    },
    {
      id: 'unauthorized',
      name: 'Comprobantes No Autorizados',
      description: 'Monitoreo de documentos que fallaron la autorización por ambiente y motivo.',
      href: '/analytics/unauthorized',
      icon: (
        <svg className="w-6 h-6 text-[#71BF44]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
        </svg>
      )
    },
    {
      id: 'pendientes-reporte',
      name: 'Pendientes de Reporte',
      description: 'Tablero de control para documentos con información de reporte pendiente.',
      href: '/analytics/pendientes-reporte',
      icon: (
        <svg className="w-6 h-6 text-[#71BF44]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17v-2a4 4 0 014-4h4m-4 4l2-2m-2 2l-2-2m2 7a2 2 0 100-4 2 2 0 000 4z" />
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

import Link from 'next/link';
import { auth } from '@/lib/auth';
import { Database, Webhook, Link2, ExternalLink } from 'lucide-react';

export default async function AnalyticsPage() {
  const session = await auth();
  const isAdmin = session?.user?.role === 'admin';

  const subsections = [
    {
      id: 'monitoreo',
      name: 'Intermitencias SRI-EC',
      description: 'Bitácora técnica de eventos, conteo de ejecuciones y detalles por país.',
      href: '/analytics/monitoreo',
      icon: (
        <svg className="w-6 h-6 text-[#71BF44]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
        </svg>
      ),
      connection: {
        type: 'Supabase',
        source: 'mySatcom.bitacora_eventos',
        method: 'Consulta Directa SQL'
      }
    },
    {
      id: 'eventos',
      name: 'Historial de Eventos',
      description: 'Seguimiento cronológico de encolamientos, reprocesos y eventos de RabbitMQ.',
      href: '/analytics/eventos',
      icon: (
        <svg className="w-6 h-6 text-[#71BF44]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      ),
      connection: {
        type: 'n8n',
        source: 'https://sara.mysatcomla.com/webhook/DetalleEventosRabbit',
        flowName: 'API Detalle Eventos Rabbit',
        flowId: 'MULTI_ENV'
      }
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
      ),
      connection: {
        type: 'n8n',
        source: 'https://sara.mysatcomla.com/webhook/MonitorRabbit',
        flowName: 'API Monitoreo Rabbit',
        flowId: '3vtUKb3F5pqASbya'
      }
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
      ),
      connection: {
        type: 'n8n',
        source: 'https://sara.mysatcomla.com/webhook/GetData',
        flowName: 'Monitoreo Procesos Consulta SP',
        flowId: 'VOfL2rAriW1s0TeQ'
      }
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
      ),
      connection: {
        type: 'n8n',
        source: 'https://sara.mysatcomla.com/webhook/GetData',
        flowName: 'Monitoreo Procesos Consulta SP',
        flowId: 'VOfL2rAriW1s0TeQ'
      }
    },
    {
      id: 'resumen-mysatcom',
      name: 'Resumen MySatcom',
      description: 'Tablero consolidado de gestiones MySatcom con comparativa interanual y por ambiente.',
      href: '/analytics/resumen-mysatcom',
      icon: (
        <svg className="w-6 h-6 text-[#71BF44]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 12l3-3 3 3 4-4M8 21l4-4 4 4M3 4h18M4 4h16v12a1 1 0 01-1 1H5a1 1 0 01-1-1V4z" />
        </svg>
      ),
      connection: {
        type: 'n8n',
        source: 'https://sara.mysatcomla.com/webhook/GetData',
        flowName: 'Consolidado MySatcom 2026',
        flowId: 'MULTI_ENV'
      }
    },
    {
      id: 'tablero-iva',
      name: 'Tablero IVA EC 2026',
      description: 'Análisis de impuestos y estados de autorización de comprobantes para Ecuador (V5).',
      href: '/analytics/tablero-iva',
      icon: (
        <svg className="w-6 h-6 text-[#71BF44]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 14l6-6m-5.5.5h.01m4.99 5h.01M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16l3.5-2 3.5 2 3.5-2 3.5 2zM10 8.5a.5.5 0 11-1 0 .5.5 0 011 0zm5 5a.5.5 0 11-1 0 .5.5 0 011 0z" />
        </svg>
      ),
      connection: {
        type: 'n8n',
        source: 'https://sara.mysatcomla.com/webhook/GetData',
        flowName: 'Tablero IVA EC 2026 (V5)',
        flowId: 'consulta_tablero_iva_ec_2026'
      }
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
          <div key={section.id} className="flex flex-col">
            <Link 
              href={section.href}
              className={`flex-1 group bg-white dark:bg-[#131313] border border-neutral-200 dark:border-neutral-800 p-6 shadow-sm hover:border-[#71BF44] transition-all ${isAdmin ? 'rounded-t-xl' : 'rounded-xl'}`}
            >
              <div className="w-12 h-12 rounded-lg bg-[#71BF44]/10 flex items-center justify-center mb-4 group-hover:bg-[#71BF44]/20 transition-colors">
                {section.icon}
              </div>
              <h3 className="text-lg font-bold text-neutral-900 dark:text-white mb-2">{section.name}</h3>
              <p className="text-sm text-neutral-500 dark:text-neutral-400 mb-4">
                {section.description}
              </p>
            </Link>
            
            {isAdmin && (
              <div className="bg-neutral-50 dark:bg-[#0a0a0a] border-x border-b border-neutral-200 dark:border-neutral-800 rounded-b-xl px-4 py-3 flex flex-col gap-2">
                <div className="flex items-center gap-2">
                  {section.connection.type === 'Supabase' ? (
                    <Database className="w-3.5 h-3.5 text-blue-500" />
                  ) : (
                    <Webhook className="w-3.5 h-3.5 text-orange-500" />
                  )}
                  <span className="text-[10px] font-bold uppercase tracking-wider text-neutral-400">
                    Conexión: {section.connection.type}
                  </span>
                </div>
                
                <div className="space-y-1">
                  <div className="flex items-start gap-1.5 group/source">
                    <Link2 className="w-3 h-3 text-neutral-400 mt-0.5 shrink-0" />
                    <span className="text-[11px] text-neutral-600 dark:text-neutral-500 break-all line-clamp-1 group-hover/source:line-clamp-none transition-all cursor-default">
                      {section.connection.source}
                    </span>
                  </div>
                  
                  {section.connection.type === 'n8n' && (
                    <div className="flex items-center gap-1.5">
                      <ExternalLink className="w-3 h-3 text-[#71BF44] shrink-0" />
                      <span className="text-[11px] font-medium text-neutral-700 dark:text-neutral-300">
                        {section.connection.flowName} 
                        {section.connection.flowId && <span className="text-neutral-500 ml-1">({section.connection.flowId})</span>}
                      </span>
                    </div>
                  )}
                  
                  {section.connection.method && (
                    <div className="flex items-center gap-1.5">
                      <span className="w-1 h-1 rounded-full bg-blue-500 ml-1 shrink-0" />
                      <span className="text-[11px] italic text-neutral-500">
                        {section.connection.method}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        ))}
        
        {/* Placeholder for future analytic sections */}
        <div className="bg-neutral-50 dark:bg-[#0a0a0a] border border-dashed border-neutral-200 dark:border-neutral-800 rounded-xl p-6 flex flex-col items-center justify-center text-center opacity-60">
          <p className="text-sm font-medium text-neutral-400">Próximos Paneles...</p>
        </div>
      </div>
    </>
  );
}

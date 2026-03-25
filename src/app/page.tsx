import TopCards from '@/components/TopCards';
import ActiveTools from '@/components/ActiveTools';

export default function Home() {
  return (
    <>
      <header className="flex flex-col sm:flex-row sm:justify-between sm:items-center mb-8 gap-4">
        <div>
          <h2 className="text-2xl font-bold text-neutral-900 dark:text-[#e5e5e5] tracking-tight">Inicio</h2>
          <p className="text-sm text-neutral-500 dark:text-[#ababab] mt-1">Monitoreo general de instancias n8n y herramientas activas.</p>
        </div>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2 sm:mr-4">
            <span className="flex h-2 w-2 relative">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#71BF44] opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-[#71BF44]"></span>
            </span>
            <span className="text-sm font-medium text-neutral-600 dark:text-[#ababab]">Sistema Operativo</span>
          </div>
        </div>
      </header>

      <TopCards />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <ActiveTools />
        </div>
        <div className="bg-white dark:bg-[#131313] border border-neutral-200 dark:border-neutral-800 rounded-xl p-6 shadow-sm flex flex-col items-center justify-center text-center">
          <div className="w-12 h-12 bg-neutral-100 dark:bg-neutral-800 rounded-full flex items-center justify-center mb-4 overflow-hidden" style={{ width: '48px', height: '48px' }}>
            <svg width="24" height="24" className="w-6 h-6 text-neutral-400 dark:text-neutral-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
            </svg>
          </div>
          <h3 className="text-sm font-semibold text-neutral-900 dark:text-white mb-2">Uso en el Tiempo</h3>
          <p className="text-xs text-neutral-500 dark:text-[#ababab] max-w-[200px]">El gráfico de ejecuciones se conectará próximamente con la API de métricas históricas.</p>
        </div>
      </div>
    </>
  );
}

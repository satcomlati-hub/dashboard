import ThemeToggle from '@/components/ThemeToggle';

export default function Credentials() {
  return (
    <>
      <header className="flex justify-between items-center mb-8">
        <div>
          <h2 className="text-2xl font-bold text-neutral-900 dark:text-[#e5e5e5] tracking-tight">Credenciales</h2>
          <p className="text-sm text-neutral-500 dark:text-[#ababab] mt-1">Gestión de conexiones y secretos para n8n.</p>
        </div>
        <div className="flex items-center gap-4">
          <ThemeToggle />
        </div>
      </header>

      <div className="bg-white dark:bg-[#131313] border border-neutral-200 dark:border-neutral-800 rounded-xl p-8 shadow-sm flex flex-col items-center justify-center text-center">
        <div className="w-16 h-16 bg-neutral-100 dark:bg-neutral-800 rounded-full flex items-center justify-center mb-4 text-[#71BF44]">
          <svg width="32" height="32" className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
          </svg>
        </div>
        <h3 className="text-lg font-semibold text-neutral-900 dark:text-white mb-2">Administración de Credenciales</h3>
        <p className="text-sm text-neutral-500 dark:text-[#ababab] max-w-md">Próximamente: Vista consolidada de credenciales entre múltiples instancias, permitiendo validar estado de conexión o expirar tokens rápidamente.</p>
      </div>
    </>
  );
}

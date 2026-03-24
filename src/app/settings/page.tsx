export default function Settings() {
  return (
    <>
      <header className="flex justify-between items-center mb-8">
        <div>
          <h2 className="text-2xl font-bold text-neutral-900 dark:text-[#e5e5e5] tracking-tight">Configuración</h2>
          <p className="text-sm text-neutral-500 dark:text-[#ababab] mt-1">Configuración del dashboard y conexiones API.</p>
        </div>
      </header>

      <div className="bg-white dark:bg-[#131313] border border-neutral-200 dark:border-neutral-800 rounded-xl p-8 shadow-sm flex flex-col items-center justify-center text-center">
        <div className="w-16 h-16 bg-neutral-100 dark:bg-neutral-800 rounded-full flex items-center justify-center mb-4 text-[#71BF44]">
          <svg width="32" height="32" className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
        </div>
        <h3 className="text-lg font-semibold text-neutral-900 dark:text-white mb-2">Ajustes Generales</h3>
        <p className="text-sm text-neutral-500 dark:text-[#ababab] max-w-md">Próximamente: Podrás configurar los endpoints de n8n, claves de API, y modificar el diseño y accesos del dashboard.</p>
      </div>
    </>
  );
}

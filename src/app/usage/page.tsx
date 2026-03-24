export default function UsagePage() {
  return (
    <>
      <header className="mb-8">
        <h2 className="text-2xl font-bold text-neutral-900 dark:text-[#e5e5e5] tracking-tight">Finanzas y Uso</h2>
        <p className="text-sm text-neutral-500 dark:text-[#ababab] mt-1">Control de costos, ejecuciones y consumo de tokens.</p>
      </header>

      <div className="bg-white dark:bg-[#131313] border border-neutral-200 dark:border-neutral-800 rounded-xl p-8 shadow-sm text-center">
        <h3 className="text-lg font-medium text-neutral-900 dark:text-white mb-2">Próximamente</h3>
        <p className="text-neutral-500 dark:text-neutral-400 max-w-md mx-auto">
          Un panel detallado con métricas monetarias, consumo por IA y desglose de costos por flujo.
        </p>
      </div>
    </>
  );
}

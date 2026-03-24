export default function ProjectsPage() {
  return (
    <>
      <header className="mb-8">
        <h2 className="text-2xl font-bold text-neutral-900 dark:text-[#e5e5e5] tracking-tight">Proyectos</h2>
        <p className="text-sm text-neutral-500 dark:text-[#ababab] mt-1">Zonas de trabajo personalizables para agrupar herramientas y flujos.</p>
      </header>

      <div className="bg-white dark:bg-[#131313] border border-neutral-200 dark:border-neutral-800 rounded-xl p-8 shadow-sm text-center">
        <h3 className="text-lg font-medium text-neutral-900 dark:text-white mb-2">Próximamente</h3>
        <p className="text-neutral-500 dark:text-neutral-400 max-w-md mx-auto">
          Aquí podrás crear tableros personalizados con widgets de logs y bases de datos para proyectos específicos como tu Sistema RAG.
        </p>
      </div>
    </>
  );
}

import Link from 'next/link';

export default function ProjectsPage() {
  const projects = [
    {
      id: 'chat-telegram',
      name: 'Chat telegram',
      description: 'Gestión y visualización de chats de Telegram y su historial.',
      href: '/projects/chat-telegram',
      icon: (
        <svg className="w-6 h-6 text-[#71BF44]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
        </svg>
      )
    },
    {
      id: 'rag',
      name: 'RAG Knowledge Base',
      description: 'Carga de archivos a base vectorial y monitoreo de logs de ingesta.',
      href: '/projects/rag',
      icon: (
        <svg className="w-6 h-6 text-[#71BF44]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
        </svg>
      )
    }
  ];

  return (
    <>
      <header className="mb-8">
        <h2 className="text-2xl font-bold text-neutral-900 dark:text-[#e5e5e5] tracking-tight">Proyectos</h2>
        <p className="text-sm text-neutral-500 dark:text-[#ababab] mt-1">Zonas de trabajo personalizables para agrupar herramientas y flujos.</p>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {projects.map((project) => (
          <Link 
            key={project.id} 
            href={project.href}
            className="group bg-white dark:bg-[#131313] border border-neutral-200 dark:border-neutral-800 rounded-xl p-6 shadow-sm hover:border-[#71BF44] transition-all"
          >
            <div className="w-12 h-12 rounded-lg bg-[#71BF44]/10 flex items-center justify-center mb-4 group-hover:bg-[#71BF44]/20 transition-colors">
              {project.icon}
            </div>
            <h3 className="text-lg font-bold text-neutral-900 dark:text-white mb-2">{project.name}</h3>
            <p className="text-sm text-neutral-500 dark:text-neutral-400">
              {project.description}
            </p>
          </Link>
        ))}
      </div>
    </>
  );
}

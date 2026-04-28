import Link from 'next/link';

export default function ChatTelegramDashboard() {
  const sections = [
    {
      id: 'chats',
      name: 'Chats',
      description: 'Visualiza todos los chats recientes y activos de Telegram.',
      href: '/projects/chat-telegram/chats',
      icon: (
        <svg className="w-6 h-6 text-[#71BF44]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8h2a2 2 0 012 2v6a2 2 0 01-2 2h-2v4l-4-4H9a1.994 1.994 0 01-1.414-.586m0 0L11 14h4a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2v4l.586-.586z" />
        </svg>
      )
    }
  ];

  return (
    <>
      <header className="mb-8">
        <div className="flex items-center gap-2 mb-2">
          <Link href="/projects" className="text-sm text-[#71BF44] hover:underline flex items-center gap-1">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            Volver a Proyectos
          </Link>
        </div>
        <h2 className="text-2xl font-bold text-neutral-900 dark:text-[#e5e5e5] tracking-tight">Chat telegram</h2>
        <p className="text-sm text-neutral-500 dark:text-[#ababab] mt-1">Panel de control para el proyecto de Telegram.</p>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {sections.map((section) => (
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
      </div>
    </>
  );
}

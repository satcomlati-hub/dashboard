'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

const TABS = [
  { href: '/projects/agentes', label: 'Agentes', exact: true },
  { href: '/projects/agentes/skills', label: 'Skills', exact: false },
  { href: '/projects/agentes/mcp', label: 'MCP', exact: false },
  { href: '/projects/agentes/herramientas', label: 'Herramientas', exact: false },
  { href: '/projects/agentes/grafo', label: 'Grafo', exact: false },
  { href: '/projects/agentes/canales', label: 'Canales', exact: false },
  { href: '/projects/agentes/comparar', label: 'Comparar', exact: false },
];

export default function AgentesNav() {
  const path = usePathname();

  const isActive = (href: string, exact: boolean) => {
    if (exact) return path === href || path === '/projects/agentes/new';
    return path.startsWith(href);
  };

  return (
    <nav className="flex gap-1 mb-6 bg-neutral-100 dark:bg-neutral-900 rounded-lg p-1 w-fit">
      {TABS.map(tab => (
        <Link
          key={tab.href}
          href={tab.href}
          className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${
            isActive(tab.href, tab.exact)
              ? 'bg-white dark:bg-[#1e1e1e] shadow-sm text-neutral-900 dark:text-white'
              : 'text-neutral-500 dark:text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200'
          }`}
        >
          {tab.label}
        </Link>
      ))}
    </nav>
  );
}

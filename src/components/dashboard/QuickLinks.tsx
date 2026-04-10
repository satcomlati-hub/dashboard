'use client';

import Link from 'next/link';
import { useSession } from 'next-auth/react';

const LINKS = [
  { name: 'Proyectos', href: '/projects', permission: 'page:projects', color: 'bg-blue-500/10 text-blue-500' },
  { name: 'Workflows', href: '/workflows', permission: 'page:workflows', color: 'bg-purple-500/10 text-purple-500' },
  { name: 'Analytics', href: '/analytics', permission: 'page:analytics', color: 'bg-emerald-500/10 text-emerald-500' },
  { name: 'SARA Chat', href: '/chat', permission: 'page:chat', color: 'bg-amber-500/10 text-amber-500' },
  { name: 'Credenciales', href: '/credentials', permission: 'page:credentials', color: 'bg-rose-500/10 text-rose-500' },
  { name: 'Finanzas', href: '/usage', permission: 'page:usage', color: 'bg-cyan-500/10 text-cyan-500' },
];

export default function QuickLinks() {
  const { data: session } = useSession();
  const permissions = session?.user?.permissions ?? [];

  const visible = LINKS.filter(l => permissions.includes(l.permission));

  return (
    <div className="bg-white dark:bg-[#131313] border border-neutral-200 dark:border-neutral-800 rounded-xl p-4 shadow-sm">
      <h3 className="text-sm font-semibold text-neutral-900 dark:text-white mb-3">Accesos Rápidos</h3>
      <div className="grid grid-cols-2 gap-2">
        {visible.map(link => (
          <Link
            key={link.href}
            href={link.href}
            className="flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-neutral-50 dark:hover:bg-neutral-800/50 transition-colors"
          >
            <span className={`w-2 h-2 rounded-full ${link.color.split(' ')[0].replace('/10', '')}`} />
            <span className="text-xs font-medium text-neutral-700 dark:text-neutral-300">{link.name}</span>
          </Link>
        ))}
      </div>
    </div>
  );
}

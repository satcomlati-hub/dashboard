'use client';

import { useState } from 'react';
import { useSession } from 'next-auth/react';
import AdminUsersTab from '@/components/settings/AdminUsersTab';
import AdminRolesTab from '@/components/settings/AdminRolesTab';

type Tab = 'users' | 'roles';

export default function Settings() {
  const { data: session } = useSession();
  const permissions = session?.user?.permissions ?? [];
  const [activeTab, setActiveTab] = useState<Tab>('users');

  const canManageUsers = permissions.includes('admin:manage_users');
  const canManageRoles = permissions.includes('admin:manage_roles');

  if (!canManageUsers && !canManageRoles) {
    return (
      <>
        <header className="flex justify-between items-center mb-8">
          <div>
            <h2 className="text-2xl font-bold text-neutral-900 dark:text-[#e5e5e5] tracking-tight">Configuración</h2>
            <p className="text-sm text-neutral-500 dark:text-[#ababab] mt-1">No tienes permisos de administración.</p>
          </div>
        </header>
      </>
    );
  }

  const tabs: { id: Tab; label: string; permission: string }[] = [
    { id: 'users', label: 'Usuarios', permission: 'admin:manage_users' },
    { id: 'roles', label: 'Roles y Permisos', permission: 'admin:manage_roles' },
  ];

  const visibleTabs = tabs.filter(t => permissions.includes(t.permission));

  // Si el tab activo no es visible, seleccionar el primero visible
  if (!visibleTabs.find(t => t.id === activeTab) && visibleTabs.length > 0) {
    setActiveTab(visibleTabs[0].id);
  }

  return (
    <>
      <header className="flex justify-between items-center mb-8">
        <div>
          <h2 className="text-2xl font-bold text-neutral-900 dark:text-[#e5e5e5] tracking-tight">Configuración</h2>
          <p className="text-sm text-neutral-500 dark:text-[#ababab] mt-1">Gestión de usuarios, roles y permisos del dashboard.</p>
        </div>
      </header>

      {/* Tabs */}
      <div className="flex gap-1 mb-6 border-b border-neutral-200 dark:border-neutral-800">
        {visibleTabs.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`px-4 py-2.5 text-sm font-medium transition-colors border-b-2 -mb-px ${
              activeTab === tab.id
                ? 'border-[#71BF44] text-[#71BF44]'
                : 'border-transparent text-neutral-500 hover:text-neutral-700 dark:hover:text-neutral-300'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="bg-white dark:bg-[#131313] border border-neutral-200 dark:border-neutral-800 rounded-xl p-6 shadow-sm">
        {activeTab === 'users' && canManageUsers && <AdminUsersTab />}
        {activeTab === 'roles' && canManageRoles && <AdminRolesTab />}
      </div>
    </>
  );
}

'use client';

import { useState } from 'react';
import { useSession } from 'next-auth/react';
import AdminUsersTab from '@/components/settings/AdminUsersTab';
import AdminRolesTab from '@/components/settings/AdminRolesTab';
import MonitoreoRulesTab from '@/components/settings/MonitoreoRulesTab';
import RabbitAlertsTab from '@/components/settings/RabbitAlertsTab';

type Tab = 'users' | 'roles' | 'monitoreo-rules' | 'monitoreo-config' | 'rabbit-rules';

export default function Settings() {
  const { data: session } = useSession();
  const permissions = session?.user?.permissions ?? [];
  const [activeTab, setActiveTab] = useState<Tab>('users');

  const canManageUsers = permissions.includes('admin:manage_users');
  const canManageRoles = permissions.includes('admin:manage_roles');
  const canManageRules = true; // TODO: Implementar permisos específicos

  if (!canManageUsers && !canManageRoles && !canManageRules) {
    return (
      <div className="p-8 text-center">
        <h2 className="text-2xl font-bold">Configuración</h2>
        <p className="text-neutral-500 mt-2">No tienes permisos de administración.</p>
      </div>
    );
  }

  const tabs: { id: Tab; label: string; permission: string | boolean }[] = [
    { id: 'users', label: 'Usuarios', permission: 'admin:manage_users' },
    { id: 'roles', label: 'Roles y Permisos', permission: 'admin:manage_roles' },
    { id: 'monitoreo-rules', label: 'Reglas de Alerta', permission: true },
    { id: 'monitoreo-config', label: 'Ambiente / Procesos', permission: true },
    { id: 'rabbit-rules', label: 'Límites RabbitMQ', permission: true },
  ];

  const visibleTabs = tabs.filter(t => t.permission === true || permissions.includes(t.permission as string));

  if (!visibleTabs.find(t => t.id === activeTab) && visibleTabs.length > 0) {
    setActiveTab(visibleTabs[0].id);
  }

  return (
    <>
      <header className="flex justify-between items-center mb-8">
        <div>
          <h2 className="text-2xl font-bold text-neutral-900 dark:text-[#e5e5e5] tracking-tight">Configuración</h2>
          <p className="text-sm text-neutral-500 dark:text-[#ababab] mt-1">Gestión del sistema, accesos y reglas de negocio.</p>
        </div>
      </header>

      {/* Tabs */}
      <div className="flex gap-1 mb-6 border-b border-neutral-200 dark:border-neutral-800 overflow-x-auto pb-px">
        {visibleTabs.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`px-4 py-2.5 text-sm font-bold transition-all border-b-2 -mb-px whitespace-nowrap ${
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
      <div className="bg-white dark:bg-[#131313] border border-neutral-200 dark:border-neutral-800 rounded-2xl p-6 shadow-sm">
        {activeTab === 'users' && canManageUsers && <AdminUsersTab />}
        {activeTab === 'roles' && canManageRoles && <AdminRolesTab />}
        {activeTab === 'monitoreo-rules' && <MonitoreoRulesTab initialTab="rules" />}
        {activeTab === 'monitoreo-config' && <MonitoreoRulesTab initialTab="config" />}
        {activeTab === 'rabbit-rules' && <RabbitAlertsTab />}
      </div>
    </>
  );
}


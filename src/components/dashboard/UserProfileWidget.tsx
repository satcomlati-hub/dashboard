'use client';

import React from 'react';
import { useSession } from 'next-auth/react';

export default function UserProfileWidget() {
  const { data: session } = useSession();
  const user = session?.user;

  const permissions = user?.permissions ?? [];

  const getCleanPermissionName = (perm: string) => {
    return perm.replace('page:', '').replace('api:', '').toUpperCase();
  };

  return (
    <div className="bg-white dark:bg-[#131313] border border-neutral-200 dark:border-neutral-800 rounded-xl p-5 shadow-xs flex flex-col h-[300px] relative group overflow-hidden">
      {/* Background shape */}
      <div className="absolute -bottom-16 -left-16 w-36 h-36 bg-[#71BF44]/5 rounded-full blur-2xl pointer-events-none" />

      <h3 className="text-xs font-semibold text-neutral-400 dark:text-neutral-500 uppercase tracking-wide mb-4 relative z-10">
        Mi Perfil y Permisos
      </h3>

      {/* User Info Block */}
      <div className="flex items-center gap-3 mb-4 relative z-10">
        {user?.image ? (
          <img 
            src={user.image} 
            alt={user.name ?? ''} 
            className="w-12 h-12 rounded-xl object-cover border-2 border-[#71BF44]/20 shadow-sm"
          />
        ) : (
          <div className="w-12 h-12 rounded-xl bg-[#71BF44]/10 text-[#71BF44] flex items-center justify-center text-lg font-bold shadow-sm border border-[#71BF44]/20">
            {user?.name?.[0] || 'U'}
          </div>
        )}
        <div className="min-w-0">
          <p className="text-sm font-bold text-neutral-800 dark:text-neutral-200 truncate">
            {user?.name || 'Usuario Satcom'}
          </p>
          <p className="text-[11px] text-neutral-400 dark:text-neutral-500 truncate mt-0.5">
            {user?.email || 'sin-correo@satcom.la'}
          </p>
          <span className="inline-block mt-1 px-2 py-0.5 rounded-md bg-[#71BF44]/10 text-[#71BF44] text-[9px] font-bold uppercase tracking-wider">
            {user?.role || 'Miembro'}
          </span>
        </div>
      </div>

      {/* Permissions List */}
      <div className="flex-1 flex flex-col min-h-0 relative z-10">
        <p className="text-[10px] font-bold text-neutral-400 dark:text-neutral-500 uppercase tracking-wider mb-2">
          Permisos Activos ({permissions.length})
        </p>
        <div className="flex-1 overflow-y-auto pr-1">
          {permissions.length === 0 ? (
            <p className="text-xs text-neutral-400 dark:text-neutral-600 italic">
              Ningún permiso asignado.
            </p>
          ) : (
            <div className="flex flex-wrap gap-1">
              {permissions.map((perm) => (
                <span 
                  key={perm} 
                  className="bg-neutral-100 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 text-neutral-600 dark:text-neutral-400 rounded-md px-1.5 py-0.5 text-[8px] font-mono font-semibold"
                >
                  {getCleanPermissionName(perm)}
                </span>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

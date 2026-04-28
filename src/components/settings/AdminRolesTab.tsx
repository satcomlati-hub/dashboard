'use client';

import { useState, useEffect, useCallback } from 'react';

interface Permission {
  id: number;
  key: string;
  label_es: string;
  category: string;
}

interface RoleRow {
  id: number;
  name: string;
  label_es: string;
  description: string;
  permissions: Permission[];
}

export default function AdminRolesTab() {
  const [roles, setRoles] = useState<RoleRow[]>([]);
  const [allPermissions, setAllPermissions] = useState<Permission[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<number | null>(null);

  const fetchRoles = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/roles');
      const data = await res.json();
      setRoles(data.roles ?? []);
      setAllPermissions(data.allPermissions ?? []);
    } catch (err) {
      console.error('Error cargando roles:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchRoles(); }, [fetchRoles]);

  const togglePermission = (roleId: number, permId: number) => {
    setRoles(prev => prev.map(r => {
      if (r.id !== roleId) return r;
      const has = r.permissions.some(p => p.id === permId);
      return {
        ...r,
        permissions: has
          ? r.permissions.filter(p => p.id !== permId)
          : [...r.permissions, allPermissions.find(p => p.id === permId)!],
      };
    }));
  };

  const saveRole = async (role: RoleRow) => {
    setSaving(role.id);
    try {
      await fetch(`/api/admin/roles/${role.id}/permissions`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ permissionIds: role.permissions.map(p => p.id) }),
      });
    } catch (err) {
      console.error('Error guardando permisos:', err);
    } finally {
      setSaving(null);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="w-6 h-6 border-2 border-[#71BF44] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const pagePerms = allPermissions.filter(p => p.category === 'page');
  const adminPerms = allPermissions.filter(p => p.category === 'admin');

  return (
    <div className="space-y-6">
      <p className="text-sm text-neutral-500 dark:text-neutral-400">
        Configura qué permisos tiene cada rol. Los cambios se aplican tras el siguiente login o al expirar el cache (5 min).
      </p>

      {roles.map(role => (
        <div key={role.id} className="border border-neutral-200 dark:border-neutral-700 rounded-xl p-5">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h4 className="text-sm font-semibold text-neutral-900 dark:text-white">{role.label_es}</h4>
              <p className="text-xs text-neutral-500 dark:text-neutral-500">{role.description}</p>
            </div>
            <button
              onClick={() => saveRole(role)}
              disabled={saving === role.id}
              className="text-xs px-3 py-1.5 rounded-md bg-[#71BF44] text-white hover:bg-[#5ea836] transition-colors disabled:opacity-50"
            >
              {saving === role.id ? 'Guardando...' : 'Guardar'}
            </button>
          </div>

          <div className="space-y-3">
            <div>
              <h5 className="text-xs font-medium text-neutral-400 uppercase tracking-wider mb-2">Páginas</h5>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {pagePerms.map(p => {
                  const checked = role.permissions.some(rp => rp.id === p.id);
                  return (
                    <label key={p.id} className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => togglePermission(role.id, p.id)}
                        className="rounded border-neutral-300 dark:border-neutral-600 text-[#71BF44] focus:ring-[#71BF44]"
                      />
                      <span className="text-xs text-neutral-700 dark:text-neutral-300">{p.label_es}</span>
                    </label>
                  );
                })}
              </div>
            </div>

            <div>
              <h5 className="text-xs font-medium text-neutral-400 uppercase tracking-wider mb-2">Administración</h5>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {adminPerms.map(p => {
                  const checked = role.permissions.some(rp => rp.id === p.id);
                  return (
                    <label key={p.id} className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => togglePermission(role.id, p.id)}
                        className="rounded border-neutral-300 dark:border-neutral-600 text-[#71BF44] focus:ring-[#71BF44]"
                      />
                      <span className="text-xs text-neutral-700 dark:text-neutral-300">{p.label_es}</span>
                    </label>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

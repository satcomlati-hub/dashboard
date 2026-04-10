'use client';

import { useState, useEffect, useCallback } from 'react';

interface UserRow {
  email: string;
  role: string;
  role_label: string;
}

const ROLES = [
  { name: 'admin', label: 'Administrador' },
  { name: 'operator', label: 'Operador' },
  { name: 'viewer', label: 'Visualizador' },
];

export default function AdminUsersTab() {
  const [users, setUsers] = useState<UserRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState<string | null>(null);

  const fetchUsers = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/users');
      const data = await res.json();
      setUsers(data.users ?? []);
    } catch (err) {
      console.error('Error cargando usuarios:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchUsers(); }, [fetchUsers]);

  const handleRoleChange = async (email: string, roleName: string) => {
    setUpdating(email);
    try {
      await fetch(`/api/admin/users/${encodeURIComponent(email)}/role`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ roleName }),
      });
      await fetchUsers();
    } catch (err) {
      console.error('Error actualizando rol:', err);
    } finally {
      setUpdating(null);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="w-6 h-6 border-2 border-[#71BF44] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div>
      <p className="text-sm text-neutral-500 dark:text-neutral-400 mb-4">
        Usuarios registrados en el sistema. El rol se aplica tras el siguiente login o refresco de sesión.
      </p>

      {users.length === 0 ? (
        <p className="text-sm text-neutral-400 py-8 text-center">No hay usuarios registrados aún.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-neutral-200 dark:border-neutral-700">
                <th className="text-left py-3 px-4 font-medium text-neutral-500 dark:text-neutral-400">Email</th>
                <th className="text-left py-3 px-4 font-medium text-neutral-500 dark:text-neutral-400">Rol</th>
              </tr>
            </thead>
            <tbody>
              {users.map(u => (
                <tr key={u.email} className="border-b border-neutral-100 dark:border-neutral-800">
                  <td className="py-3 px-4 text-neutral-800 dark:text-neutral-200">{u.email}</td>
                  <td className="py-3 px-4">
                    <select
                      value={u.role}
                      onChange={(e) => handleRoleChange(u.email, e.target.value)}
                      disabled={updating === u.email}
                      className="bg-neutral-50 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-md px-2 py-1 text-sm text-neutral-800 dark:text-neutral-200 disabled:opacity-50"
                    >
                      {ROLES.map(r => (
                        <option key={r.name} value={r.name}>{r.label}</option>
                      ))}
                    </select>
                    {updating === u.email && (
                      <span className="ml-2 text-xs text-neutral-400">Guardando...</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { query } from '@/lib/db';

export async function GET() {
  const session = await auth();
  if (!session?.user?.permissions?.includes('admin:manage_roles')) {
    return NextResponse.json({ error: 'Sin permisos' }, { status: 403 });
  }

  const roles = await query(`
    SELECT r.id, r.name, r.label_es, r.description,
      COALESCE(
        json_agg(json_build_object('id', p.id, 'key', p.key, 'label_es', p.label_es, 'category', p.category))
        FILTER (WHERE p.id IS NOT NULL),
        '[]'
      ) AS permissions
    FROM dashboard.roles r
    LEFT JOIN dashboard.role_permissions rp ON rp.role_id = r.id
    LEFT JOIN dashboard.permissions p ON p.id = rp.permission_id
    GROUP BY r.id, r.name, r.label_es, r.description
    ORDER BY r.id
  `);

  const allPerms = await query('SELECT id, key, label_es, category FROM dashboard.permissions ORDER BY id');

  return NextResponse.json({
    roles: roles.rows,
    allPermissions: allPerms.rows,
  });
}

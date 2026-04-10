import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { query } from '@/lib/db';
import redis from '@/lib/redis';

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.permissions?.includes('admin:manage_roles')) {
    return NextResponse.json({ error: 'Sin permisos' }, { status: 403 });
  }

  const { id } = await params;
  const roleId = parseInt(id, 10);
  const { permissionIds } = await request.json() as { permissionIds: number[] };

  if (!Array.isArray(permissionIds)) {
    return NextResponse.json({ error: 'permissionIds debe ser un array' }, { status: 400 });
  }

  // Reemplazar permisos del rol
  await query('DELETE FROM dashboard.role_permissions WHERE role_id = $1', [roleId]);

  if (permissionIds.length > 0) {
    const values = permissionIds.map((pid, i) => `($1, $${i + 2})`).join(', ');
    await query(
      `INSERT INTO dashboard.role_permissions (role_id, permission_id) VALUES ${values}`,
      [roleId, ...permissionIds]
    );
  }

  // Invalidar cache de todos los usuarios con este rol
  const usersWithRole = await query(
    'SELECT email FROM dashboard.user_roles WHERE role_id = $1',
    [roleId]
  );

  try {
    const pipeline = redis.pipeline();
    for (const row of usersWithRole.rows) {
      pipeline.del(`perms:${row.email}`);
    }
    await pipeline.exec();
  } catch {
    // Redis down
  }

  return NextResponse.json({ ok: true });
}

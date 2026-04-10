import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { query } from '@/lib/db';
import { invalidatePermissionsCache } from '@/lib/permissions';

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ email: string }> }
) {
  const session = await auth();
  if (!session?.user?.permissions?.includes('admin:manage_users')) {
    return NextResponse.json({ error: 'Sin permisos' }, { status: 403 });
  }

  const { email } = await params;
  const { roleName } = await request.json() as { roleName: string };
  const decodedEmail = decodeURIComponent(email);

  // Verificar que el rol existe
  const roleResult = await query(
    'SELECT id FROM dashboard.roles WHERE name = $1',
    [roleName]
  );

  if (roleResult.rows.length === 0) {
    return NextResponse.json({ error: 'Rol no encontrado' }, { status: 404 });
  }

  await query(
    `INSERT INTO dashboard.user_roles (email, role_id) VALUES ($1, $2)
     ON CONFLICT (email) DO UPDATE SET role_id = $2`,
    [decodedEmail, roleResult.rows[0].id]
  );

  // Invalidar cache de permisos
  await invalidatePermissionsCache(decodedEmail);

  return NextResponse.json({ ok: true });
}

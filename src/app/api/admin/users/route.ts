import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { query } from '@/lib/db';

export async function GET() {
  const session = await auth();
  if (!session?.user?.permissions?.includes('admin:manage_users')) {
    return NextResponse.json({ error: 'Sin permisos' }, { status: 403 });
  }

  const result = await query(`
    SELECT ur.email, r.name AS role, r.label_es AS role_label
    FROM dashboard.user_roles ur
    JOIN dashboard.roles r ON r.id = ur.role_id
    ORDER BY ur.email
  `);

  return NextResponse.json({ users: result.rows });
}

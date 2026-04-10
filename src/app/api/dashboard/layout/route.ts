import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { query } from '@/lib/db';
import { DEFAULT_LAYOUT } from '@/lib/widgets';
import type { WidgetLayoutItem } from '@/lib/widgets';

export async function GET() {
  const session = await auth();
  if (!session?.user?.email) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  }

  const result = await query(
    'SELECT layout FROM dashboard.user_dashboard WHERE email = $1',
    [session.user.email]
  );

  const layout: WidgetLayoutItem[] = result.rows.length > 0
    ? result.rows[0].layout
    : DEFAULT_LAYOUT;

  return NextResponse.json({ layout });
}

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.email) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  }

  const { layout } = await request.json() as { layout: WidgetLayoutItem[] };

  if (!Array.isArray(layout)) {
    return NextResponse.json({ error: 'Layout inválido' }, { status: 400 });
  }

  await query(
    `INSERT INTO dashboard.user_dashboard (email, layout, updated_at)
     VALUES ($1, $2, NOW())
     ON CONFLICT (email) DO UPDATE SET layout = $2, updated_at = NOW()`,
    [session.user.email, JSON.stringify(layout)]
  );

  return NextResponse.json({ ok: true });
}

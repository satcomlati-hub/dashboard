import { NextResponse } from 'next/server';
import { query } from '@/lib/db';

export const dynamic = 'force-dynamic';

const TYPES = ['user', 'channel'] as const;

// GET → lista de destinatarios de alertas de límites.
export async function GET() {
  try {
    const res = await query(
      `SELECT id, type, value, label, enabled, created_at
       FROM ag_alert_recipients
       ORDER BY type, value`,
    );
    return NextResponse.json(
      res.rows.map(r => ({
        id: r.id as string,
        type: r.type as string,
        value: r.value as string,
        label: (r.label as string | null) ?? '',
        enabled: r.enabled as boolean,
        createdAt: new Date(r.created_at as string).toISOString(),
      })),
    );
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

// POST → añade un destinatario { type, value, label? }.
export async function POST(req: Request) {
  try {
    const body = await req.json();
    const type = String(body?.type ?? '');
    const value = String(body?.value ?? '').trim();
    const label = body?.label != null ? String(body.label).trim() : null;
    if (!TYPES.includes(type as (typeof TYPES)[number])) {
      return NextResponse.json({ error: 'type debe ser "user" o "channel".' }, { status: 400 });
    }
    if (!value) {
      return NextResponse.json({ error: 'El valor (email/zuid o canal) es obligatorio.' }, { status: 400 });
    }
    const res = await query(
      `INSERT INTO ag_alert_recipients (type, value, label)
       VALUES ($1, $2, $3)
       ON CONFLICT (type, lower(value)) DO UPDATE SET label = EXCLUDED.label, enabled = true
       RETURNING id, type, value, label, enabled, created_at`,
      [type, value, label || null],
    );
    const r = res.rows[0];
    return NextResponse.json({
      id: r.id as string,
      type: r.type as string,
      value: r.value as string,
      label: (r.label as string | null) ?? '',
      enabled: r.enabled as boolean,
      createdAt: new Date(r.created_at as string).toISOString(),
    });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

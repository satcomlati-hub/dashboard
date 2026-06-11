import { NextResponse } from 'next/server';
import { query } from '@/lib/db';

export const dynamic = 'force-dynamic';

// PATCH → actualiza { enabled?, label? } de un destinatario.
export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await ctx.params;
    const body = await req.json();
    const sets: string[] = [];
    const vals: unknown[] = [];
    if (typeof body?.enabled === 'boolean') {
      vals.push(body.enabled);
      sets.push(`enabled = $${vals.length}`);
    }
    if (typeof body?.label === 'string') {
      vals.push(body.label.trim() || null);
      sets.push(`label = $${vals.length}`);
    }
    if (sets.length === 0) {
      return NextResponse.json({ error: 'Nada que actualizar.' }, { status: 400 });
    }
    vals.push(id);
    const res = await query(
      `UPDATE ag_alert_recipients SET ${sets.join(', ')} WHERE id = $${vals.length}
       RETURNING id, type, value, label, enabled, created_at`,
      vals as never[],
    );
    if (res.rowCount === 0) {
      return NextResponse.json({ error: 'No encontrado.' }, { status: 404 });
    }
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

// DELETE → elimina un destinatario.
export async function DELETE(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await ctx.params;
    await query(`DELETE FROM ag_alert_recipients WHERE id = $1`, [id]);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

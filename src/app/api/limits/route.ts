import { NextResponse } from 'next/server';
import { query } from '@/lib/db';

export const dynamic = 'force-dynamic';

const BUCKETS = ['hour', 'day', 'week'] as const;
const ACTIONS = ['notify', 'stop'] as const;

// Sanea el jsonb de límites antes de persistir: solo ventanas conocidas, usd
// numérico >= 0, acción válida.
function sanitizeLimits(input: unknown): Record<string, { usd: number; action: string }> {
  const out: Record<string, { usd: number; action: string }> = {};
  if (!input || typeof input !== 'object') return out;
  for (const b of BUCKETS) {
    const cfg = (input as any)[b];
    if (!cfg || typeof cfg !== 'object') continue;
    const usd = Number(cfg.usd);
    if (!Number.isFinite(usd) || usd <= 0) continue;
    const action = ACTIONS.includes(cfg.action) ? cfg.action : 'notify';
    out[b] = { usd, action };
  }
  return out;
}

// GET → estado del control de uso: tope global, costo global por ventana,
// agentes con tope configurado (+ su costo actual), y eventos recientes.
export async function GET() {
  try {
    const [globalRow, agentRows, costRows, eventRows] = await Promise.all([
      query(`SELECT limits FROM ag_global_limits WHERE id = true`),
      query(`SELECT id, name, slug, model, COALESCE(limits, '{}'::jsonb) AS limits FROM ag_agents ORDER BY name`),
      query(`
        WITH base AS (
          SELECT rn.agent_id, rn.created_at,
            COALESCE((rn.usage->>'prompt_tokens')::bigint, 0) AS inp,
            GREATEST(COALESCE((rn.usage->>'total_tokens')::bigint, 0)
              - COALESCE((rn.usage->>'prompt_tokens')::bigint, 0), 0) AS outp,
            a.model
          FROM ag_runs rn JOIN ag_agents a ON a.id = rn.agent_id
          WHERE rn.created_at > now() - interval '7 days' AND rn.status <> 'error'
        ), priced AS (
          SELECT b.agent_id, b.created_at,
            (b.inp * COALESCE(p.input_per_1m, 0) / 1e6
             + b.outp * COALESCE(p.output_per_1m, 0) / 1e6) AS cost
          FROM base b
          LEFT JOIN LATERAL (
            SELECT input_per_1m, output_per_1m FROM ai_pricing
            WHERE model = b.model AND tier = 'standard' AND effective_from <= CURRENT_DATE
            ORDER BY effective_from DESC LIMIT 1
          ) p ON true
        )
        SELECT agent_id,
          COALESCE(SUM(cost) FILTER (WHERE created_at > now() - interval '1 hour'), 0) AS hour,
          COALESCE(SUM(cost) FILTER (WHERE created_at > now() - interval '1 day'), 0)  AS day,
          COALESCE(SUM(cost), 0) AS week
        FROM priced GROUP BY agent_id
      `),
      query(`
        SELECT e.id, e.scope, e.agent_id, a.name AS agent_name, e.bucket, e.action,
          e.limit_usd, e.actual_usd, e.source, e.notified_cliq, e.created_at
        FROM ag_limit_events e
        LEFT JOIN ag_agents a ON a.id = e.agent_id
        ORDER BY e.created_at DESC
        LIMIT 50
      `),
    ]);

    const costByAgent = new Map<string, { hour: number; day: number; week: number }>();
    let gHour = 0, gDay = 0, gWeek = 0;
    for (const c of costRows.rows) {
      const h = Number(c.hour), d = Number(c.day), w = Number(c.week);
      costByAgent.set(c.agent_id as string, { hour: h, day: d, week: w });
      gHour += h; gDay += d; gWeek += w;
    }

    const agents = agentRows.rows.map(a => ({
      id: a.id as string,
      name: a.name as string,
      slug: a.slug as string,
      model: a.model as string,
      limits: a.limits || {},
      cost: costByAgent.get(a.id as string) || { hour: 0, day: 0, week: 0 },
    }));

    return NextResponse.json({
      globalLimits: globalRow.rows[0]?.limits || {},
      globalCost: { hour: gHour, day: gDay, week: gWeek },
      agents,
      events: eventRows.rows.map(e => ({
        id: e.id as string,
        scope: e.scope as string,
        agentId: e.agent_id as string | null,
        agentName: e.agent_name as string | null,
        bucket: e.bucket as string,
        action: e.action as string,
        limitUsd: Number(e.limit_usd),
        actualUsd: Number(e.actual_usd),
        source: e.source as string | null,
        notifiedCliq: e.notified_cliq as boolean,
        createdAt: new Date(e.created_at).toISOString(),
      })),
    });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

// PUT → actualiza el tope global.
export async function PUT(req: Request) {
  try {
    const body = await req.json();
    const limits = sanitizeLimits(body?.limits);
    await query(
      `UPDATE ag_global_limits SET limits = $1::jsonb, updated_at = now() WHERE id = true`,
      [JSON.stringify(limits)],
    );
    return NextResponse.json({ ok: true, limits });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

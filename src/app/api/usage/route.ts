import { NextResponse } from 'next/server';
import { query } from '@/lib/db';

export const dynamic = 'force-dynamic';

const N8N_PRIMARY = (process.env.N8N_PRIMARY_HOST || '').replace(/\/$/, '');
const N8N_PRIMARY_KEY = process.env.N8N_PRIMARY_JWT || '';
const N8N_SARA = (process.env.N8N_SARA_HOST || '').replace(/\/$/, '');
const N8N_SARA_KEY = process.env.N8N_SARA_JWT || '';
const VERCEL_TOKEN = process.env.VERCEL_TOKEN || '';
const VERCEL_TEAM_ID = process.env.VERCEL_TEAM_ID || '';

const INTERVALS: Record<string, string> = {
  '7d': '7 days',
  '30d': '30 days',
  '90d': '90 days',
};

async function n8nGet(host: string, key: string, path: string): Promise<any> {
  if (!host || !key) return null;
  try {
    const res = await fetch(`${host}${path}`, {
      headers: { 'X-N8N-API-KEY': key, Accept: 'application/json' },
      signal: AbortSignal.timeout(8_000),
      cache: 'no-store',
    });
    return res.ok ? res.json() : null;
  } catch {
    return null;
  }
}

function parseN8NInstance(wfRes: any, execRes: any) {
  const wfs = Array.isArray(wfRes?.data) ? wfRes.data : [];
  const execs = Array.isArray(execRes?.data) ? execRes.data : [];
  return {
    connected: wfRes !== null,
    totalWorkflows: wfs.length,
    activeWorkflows: wfs.filter((w: any) => w.active === true).length,
    executions: execs.length,
  };
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const rangeKey = INTERVALS[searchParams.get('range') || ''] ? searchParams.get('range')! : '30d';
  const interval = INTERVALS[rangeKey];

  try {
    const [
      aiModelRows,
      aiSourceRows,
      aiTrendRows,
      aiPricingRows,
      dbSizeRes,
      serviceDailyRows,
      primaryWfRes,
      primaryExecRes,
      saraWfRes,
      saraExecRes,
    ] = await Promise.all([
      // AI usage by model
      query(
        `SELECT provider, model,
          SUM(input_tokens)::bigint  AS input_tokens,
          SUM(output_tokens)::bigint AS output_tokens,
          SUM(cached_tokens)::bigint AS cached_tokens,
          ROUND(SUM(cost_usd)::numeric, 6) AS cost_usd,
          COUNT(*)::int AS calls,
          MAX(created_at) AS last_call
         FROM ai_usage
         WHERE created_at > NOW() - $1::interval AND status != 'error'
         GROUP BY provider, model
         ORDER BY cost_usd DESC NULLS LAST`,
        [interval],
      ),
      // AI usage by source
      query(
        `SELECT source,
          SUM(input_tokens)::bigint  AS input_tokens,
          SUM(output_tokens)::bigint AS output_tokens,
          ROUND(SUM(cost_usd)::numeric, 6) AS cost_usd,
          COUNT(*)::int AS calls
         FROM ai_usage
         WHERE created_at > NOW() - $1::interval AND status != 'error'
         GROUP BY source
         ORDER BY cost_usd DESC NULLS LAST`,
        [interval],
      ),
      // Daily trend (always last 30 days for chart continuity)
      query(`
        SELECT
          DATE(created_at) AS day,
          SUM(input_tokens + output_tokens)::bigint AS tokens,
          ROUND(SUM(cost_usd)::numeric, 6) AS cost_usd,
          COUNT(*)::int AS calls
        FROM ai_usage
        WHERE created_at > NOW() - INTERVAL '30 days' AND status != 'error'
        GROUP BY DATE(created_at)
        ORDER BY day ASC
      `),
      // Configured pricing
      query(`
        SELECT DISTINCT ON (provider, model)
          provider, model,
          input_per_1m, output_per_1m, cached_per_1m
        FROM ai_pricing
        WHERE effective_from <= CURRENT_DATE
        ORDER BY provider, model, effective_from DESC
      `),
      // DB size (live)
      query('SELECT pg_database_size(current_database())::bigint AS db_bytes'),
      // Latest service metrics (last 30 days)
      query(`
        SELECT service, metric, value, cost_usd, day
        FROM service_usage_daily
        WHERE day >= CURRENT_DATE - 30
        ORDER BY day DESC, service
        LIMIT 300
      `),
      // n8n Cloud Primary
      n8nGet(N8N_PRIMARY, N8N_PRIMARY_KEY, '/api/v1/workflows?limit=200'),
      n8nGet(N8N_PRIMARY, N8N_PRIMARY_KEY, '/api/v1/executions?limit=250'),
      // n8n SARA
      n8nGet(N8N_SARA, N8N_SARA_KEY, '/api/v1/workflows?limit=200'),
      n8nGet(N8N_SARA, N8N_SARA_KEY, '/api/v1/executions?limit=250'),
    ]);

    // ── AI models ──
    const models = aiModelRows.rows.map(r => ({
      provider: r.provider as string,
      model: r.model as string,
      inputTokens: Number(r.input_tokens),
      outputTokens: Number(r.output_tokens),
      cachedTokens: Number(r.cached_tokens),
      costUsd: Number(r.cost_usd),
      calls: Number(r.calls),
      lastCall: r.last_call ? new Date(r.last_call).toISOString() : null,
    }));

    const sources = aiSourceRows.rows.map(r => ({
      source: r.source as string,
      inputTokens: Number(r.input_tokens),
      outputTokens: Number(r.output_tokens),
      costUsd: Number(r.cost_usd),
      calls: Number(r.calls),
    }));

    const trend = aiTrendRows.rows.map(r => ({
      day: (r.day as Date).toISOString().split('T')[0],
      tokens: Number(r.tokens),
      costUsd: Number(r.cost_usd),
      calls: Number(r.calls),
    }));

    const pricing = aiPricingRows.rows.map(r => ({
      provider: r.provider as string,
      model: r.model as string,
      inputPer1M: Number(r.input_per_1m),
      outputPer1M: Number(r.output_per_1m),
      cachedPer1M: Number(r.cached_per_1m),
    }));

    const aiSummary = {
      totalCostUsd: models.reduce((s, m) => s + m.costUsd, 0),
      totalTokens: models.reduce((s, m) => s + m.inputTokens + m.outputTokens, 0),
      totalInputTokens: models.reduce((s, m) => s + m.inputTokens, 0),
      totalOutputTokens: models.reduce((s, m) => s + m.outputTokens, 0),
      totalCalls: models.reduce((s, m) => s + m.calls, 0),
    };

    // ── Infrastructure ──
    const dbBytes = Number(dbSizeRes.rows[0]?.db_bytes || 0);
    const dbMb = Math.round((dbBytes / (1024 * 1024)) * 100) / 100;

    // Latest value per (service, metric)
    const svcMap: Record<string, Record<string, number>> = {};
    for (const r of serviceDailyRows.rows) {
      if (!svcMap[r.service]) svcMap[r.service] = {};
      if (svcMap[r.service][r.metric] === undefined) {
        svcMap[r.service][r.metric] = Number(r.value);
      }
    }

    // ── Vercel (optional) ──
    let vercelData: any = { configured: false };
    if (VERCEL_TOKEN && VERCEL_TEAM_ID) {
      try {
        const vr = await fetch(
          `https://api.vercel.com/v2/teams/${VERCEL_TEAM_ID}/usage`,
          { headers: { Authorization: `Bearer ${VERCEL_TOKEN}` }, signal: AbortSignal.timeout(6_000) },
        );
        if (vr.ok) vercelData = { configured: true, ...(await vr.json()) };
      } catch { /* degraded */ }
    }

    return NextResponse.json({
      range: rangeKey,
      ai: {
        models,
        sources,
        summary: aiSummary,
        trend,
        pricing,
      },
      infra: {
        supabase: {
          dbMb,
          storageGb: svcMap['supabase']?.storage_gb ?? null,
          bandwidthGb: svcMap['supabase']?.bandwidth_gb ?? null,
          mau: svcMap['supabase']?.mau ?? null,
          edgeFn: svcMap['supabase']?.edge_fn ?? null,
        },
        n8n: {
          primary: parseN8NInstance(primaryWfRes, primaryExecRes),
          sara: parseN8NInstance(saraWfRes, saraExecRes),
        },
        vercel: vercelData,
      },
    });
  } catch (err) {
    console.error('[usage] API error:', err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

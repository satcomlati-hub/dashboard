'use client';
import { useState, useEffect, useCallback } from 'react';
import {
  LineChart, Line, BarChart, Bar, XAxis, YAxis,
  Tooltip, CartesianGrid, ResponsiveContainer, Cell,
} from 'recharts';

// ─── Types ────────────────────────────────────────────────────────────────────
interface AIModel {
  provider: string; model: string;
  inputTokens: number; outputTokens: number; cachedTokens: number;
  costUsd: number; calls: number; lastCall: string | null;
}
interface AISource {
  source: string; inputTokens: number; outputTokens: number;
  costUsd: number; calls: number;
}
interface TrendPoint { day: string; tokens: number; costUsd: number; calls: number }
interface Pricing { provider: string; model: string; inputPer1M: number; outputPer1M: number; cachedPer1M: number }
interface N8NInst { connected: boolean; totalWorkflows: number; activeWorkflows: number; executions: number }
interface UsageData {
  range: string;
  ai: {
    models: AIModel[]; sources: AISource[]; trend: TrendPoint[]; pricing: Pricing[];
    summary: { totalCostUsd: number; totalTokens: number; totalInputTokens: number; totalOutputTokens: number; totalCalls: number };
  };
  infra: {
    supabase: { dbMb: number; storageGb: number | null; bandwidthGb: number | null; mau: number | null; edgeFn: number | null };
    n8n: { primary: N8NInst; sara: N8NInst };
    vercel: { configured: boolean; [k: string]: any };
  };
}

// ─── Static plan limits ───────────────────────────────────────────────────────
const SUPABASE_LIMITS = { DB_MB: 500, STORAGE_GB: 1, BANDWIDTH_GB: 5, MAU: 50_000, EDGE_FN: 500_000 };
const N8N_STARTER = { EXEC: 2_500, PRICE: 20, CONCURRENT: 5, RAM_MIB: 320 };
const N8N_PRO = { EXEC: 10_000, PRICE: 50, CONCURRENT: 20, RAM_MIB: 1_280 };
const VERCEL_LIMITS = { BANDWIDTH_GB: 100, BUILD_MINUTES: 6_000 };
// Manual fallback (updated 2026-04-22) while VERCEL_TOKEN isn't configured
const VERCEL_STATIC = { BANDWIDTH_GB: 2.3, BUILD_MINUTES: 52 };
const GEMINI_CREDIT = 300;

// ─── Helpers ──────────────────────────────────────────────────────────────────
function fmt$(n: number) {
  if (n === 0) return '$0.00';
  if (n < 0.001) return `$${n.toFixed(6)}`;
  if (n < 1) return `$${n.toFixed(4)}`;
  return `$${n.toFixed(2)}`;
}
function fmtK(n: number) {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return n.toLocaleString();
}
function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString('es-MX', { month: 'short', day: 'numeric' });
}
function fmtRelTime(iso: string | null) {
  if (!iso) return '—';
  const s = Math.round((Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return 'hace unos segundos';
  if (s < 3600) return `hace ${Math.round(s / 60)} min`;
  if (s < 86400) return `hace ${Math.round(s / 3600)} h`;
  return `hace ${Math.round(s / 86400)} días`;
}
function pct(val: number, max: number) { return Math.min(100, Math.max(0, (val / max) * 100)); }
function pctColor(p: number) { return p > 85 ? '#ef4444' : p > 60 ? '#f59e0b' : '#71BF44'; }
function modelLabel(m: string) {
  return m
    .replace('gemini-', 'Gemini ')
    .replace('gpt-', 'GPT-')
    .replace(/-preview$/, ' (preview)')
    .replace(/-lite$/, ' Lite');
}

// ─── Sub-components ───────────────────────────────────────────────────────────
function ProgressBar({ value, max, small }: { value: number; max: number; small?: boolean }) {
  const p = pct(value, max);
  const color = pctColor(p);
  return (
    <div className={small ? 'mt-1' : 'mt-1.5'}>
      {!small && (
        <div className="flex justify-between text-[11px] text-neutral-400 dark:text-neutral-500 mb-1">
          <span>{p.toFixed(1)}% usado</span>
          <span>{(max - value).toLocaleString(undefined, { maximumFractionDigits: 1 })} libres</span>
        </div>
      )}
      <div className={`${small ? 'h-1' : 'h-1.5'} bg-neutral-100 dark:bg-neutral-800 rounded-full overflow-hidden`}>
        <div className="h-full rounded-full transition-all duration-500" style={{ width: `${Math.max(p, 0.4)}%`, background: color }} />
      </div>
    </div>
  );
}

function Badge({ label, variant }: { label: string; variant: 'free' | 'paid' | 'credit' | 'testing' | 'ok' | 'warn' | 'err' }) {
  const styles = {
    free:    'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400',
    paid:    'bg-blue-500/10 text-blue-600 dark:text-blue-400',
    credit:  'bg-amber-500/10 text-amber-600 dark:text-amber-400',
    testing: 'bg-neutral-500/10 text-neutral-500 dark:text-neutral-400',
    ok:      'bg-[#71BF44]/10 text-[#4a8a2a] dark:text-[#71BF44]',
    warn:    'bg-amber-500/10 text-amber-600 dark:text-amber-400',
    err:     'bg-red-500/10 text-red-600 dark:text-red-400',
  };
  return <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${styles[variant]}`}>{label}</span>;
}

function Card({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`bg-white dark:bg-[#131313] border border-neutral-200 dark:border-neutral-800 rounded-xl shadow-sm ${className}`}>
      {children}
    </div>
  );
}

function SectionCard({ title, badge, icon, children }: {
  title: string; badge: React.ReactNode; icon: React.ReactNode; children: React.ReactNode;
}) {
  return (
    <Card className="p-6">
      <div className="flex items-start justify-between mb-5">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-neutral-100 dark:bg-neutral-800 flex items-center justify-center flex-shrink-0">
            {icon}
          </div>
          <h3 className="text-base font-semibold text-neutral-900 dark:text-white">{title}</h3>
        </div>
        {badge}
      </div>
      {children}
    </Card>
  );
}

function InfoBox({ children, variant = 'neutral' }: { children: React.ReactNode; variant?: 'neutral' | 'warn' | 'ok' | 'err' }) {
  const s = {
    neutral: 'bg-neutral-50 dark:bg-neutral-900/50 border-neutral-200 dark:border-neutral-700 text-neutral-500 dark:text-neutral-400',
    warn: 'bg-amber-500/5 border-amber-500/20 text-amber-700 dark:text-amber-400',
    ok: 'bg-[#71BF44]/5 border-[#71BF44]/20 text-[#4a8a2a] dark:text-[#71BF44]',
    err: 'bg-red-500/5 border-red-500/20 text-red-700 dark:text-red-400',
  };
  return (
    <div className={`flex items-start gap-2 p-3 border rounded-lg mt-3 text-xs ${s[variant]}`}>
      <svg width="13" height="13" className="flex-shrink-0 mt-0.5" viewBox="0 0 24 24" fill="none" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
      <p>{children}</p>
    </div>
  );
}

function TabBtn({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={`px-4 py-1.5 text-sm font-medium rounded-md transition-all ${
        active
          ? 'bg-white dark:bg-[#1e1e1e] text-neutral-900 dark:text-white shadow-sm'
          : 'text-neutral-500 dark:text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-300'
      }`}
    >
      {label}
    </button>
  );
}

function MetricRow({ label, val, max, unit }: { label: string; val: number | null; max: number; unit: string }) {
  const v = val ?? 0;
  const isEstimated = val === null;
  return (
    <div>
      <div className="flex justify-between text-sm">
        <span className="text-neutral-600 dark:text-neutral-400">{label}</span>
        <span className="text-xs font-mono text-neutral-700 dark:text-neutral-300">
          {isEstimated ? <span className="text-neutral-400">—</span> : `${v.toLocaleString(undefined, { maximumFractionDigits: 1 })} / ${max.toLocaleString()} ${unit}`}
        </span>
      </div>
      <ProgressBar value={v} max={max} />
    </div>
  );
}

// Custom recharts tooltip
const ChartTooltip = ({ active, payload, label, formatter }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-[#1a1a1a] border border-neutral-700 rounded-lg px-3 py-2 text-xs shadow-xl">
      <p className="text-neutral-400 mb-1">{label}</p>
      {payload.map((p: any, i: number) => (
        <p key={i} style={{ color: p.color || '#71BF44' }}>
          {p.name}: {formatter ? formatter(p.value, p.name) : p.value}
        </p>
      ))}
    </div>
  );
};

// ─── Icons ────────────────────────────────────────────────────────────────────
const IconGemini = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" className="text-amber-500">
    <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);
const IconDatabase = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" className="text-emerald-500">
    <ellipse cx="12" cy="5" rx="9" ry="3" stroke="currentColor" strokeWidth="2" />
    <path d="M3 5v14c0 1.657 4.03 3 9 3s9-1.343 9-3V5" stroke="currentColor" strokeWidth="2" />
    <path d="M3 12c0 1.657 4.03 3 9 3s9-1.343 9-3" stroke="currentColor" strokeWidth="2" />
  </svg>
);
const IconN8N = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" className="text-[#71BF44]">
    <path d="M13 10V3L4 14h7v7l9-11h-7z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);
const IconServer = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" className="text-neutral-400">
    <rect x="2" y="2" width="20" height="8" rx="2" stroke="currentColor" strokeWidth="2" />
    <rect x="2" y="14" width="20" height="8" rx="2" stroke="currentColor" strokeWidth="2" />
    <line x1="6" y1="6" x2="6.01" y2="6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    <line x1="6" y1="18" x2="6.01" y2="18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
  </svg>
);
const IconVercel = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" className="text-neutral-900 dark:text-white">
    <path d="M12 2L2 19.8h20L12 2z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

// ─── Page ─────────────────────────────────────────────────────────────────────
export default function UsagePage() {
  const [data, setData] = useState<UsageData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [range, setRange] = useState<'7d' | '30d' | '90d'>('30d');
  const [tab, setTab] = useState<'ia' | 'infra' | 'proyecciones' | 'origen'>('ia');
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/usage?range=${range}`, { cache: 'no-store' });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const d: UsageData = await res.json();
      setData(d);
      setLastUpdated(new Date());
      setError(null);
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  }, [range]);

  useEffect(() => {
    setLoading(true);
    load();
    const id = setInterval(load, 60_000);
    return () => clearInterval(id);
  }, [load]);

  // ── Derived values ──
  const ai = data?.ai;
  const infra = data?.infra;
  const n8nExec = (infra?.n8n.primary.executions ?? 0) + (infra?.n8n.sara.executions ?? 0);
  const n8nActiveWf = (infra?.n8n.primary.activeWorkflows ?? 0) + (infra?.n8n.sara.activeWorkflows ?? 0);
  const dbMb = infra?.supabase.dbMb ?? 0;
  const totalCost = ai?.summary.totalCostUsd ?? 0;

  // Projection from trend
  const trendDays = ai?.trend.length ?? 0;
  const avgDailyCost = trendDays > 0
    ? (ai?.trend.reduce((s, t) => s + t.costUsd, 0) ?? 0) / trendDays
    : 0;
  const projMonthCost = avgDailyCost * 30;
  const projYearCost = (projMonthCost + N8N_STARTER.PRICE) * 12;

  // Projection table rows
  const projRows = Array.from({ length: 6 }, (_, i) => {
    const d = new Date();
    d.setMonth(d.getMonth() + i);
    return {
      label: d.toLocaleDateString('es-MX', { month: 'short', year: '2-digit' }),
      ai: i === 0 ? totalCost : projMonthCost,
      n8n: N8N_STARTER.PRICE,
      total: (i === 0 ? totalCost : projMonthCost) + N8N_STARTER.PRICE,
    };
  });

  // ── Bar chart colors ──
  const MODEL_COLORS = ['#71BF44', '#3b82f6', '#f59e0b', '#8b5cf6', '#ec4899', '#14b8a6'];

  return (
    <>
      {/* ── Header ── */}
      <header className="mb-6 flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h2 className="text-2xl font-bold text-neutral-900 dark:text-[#e5e5e5] tracking-tight">Finanzas y Uso</h2>
          <p className="text-sm text-neutral-500 dark:text-[#ababab] mt-1">
            Costos en tiempo real · Supabase, n8n Cloud y Gemini API
          </p>
        </div>
        <div className="flex items-center gap-2 text-xs text-neutral-400 dark:text-neutral-500">
          {loading && <span className="animate-pulse">Actualizando…</span>}
          {!loading && lastUpdated && (
            <span>Actualizado {lastUpdated.toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' })}</span>
          )}
          {/* Range selector */}
          <div className="flex gap-0.5 bg-neutral-100 dark:bg-neutral-900 p-0.5 rounded-lg ml-2">
            {(['7d', '30d', '90d'] as const).map(r => (
              <button
                key={r}
                onClick={() => setRange(r)}
                className={`px-3 py-1 rounded text-xs font-medium transition-all ${
                  range === r
                    ? 'bg-white dark:bg-[#1e1e1e] text-neutral-900 dark:text-white shadow-sm'
                    : 'text-neutral-500 hover:text-neutral-700 dark:hover:text-neutral-300'
                }`}
              >
                {r}
              </button>
            ))}
          </div>
        </div>
      </header>

      {error && (
        <div className="mb-5 p-3 bg-red-500/5 border border-red-500/20 rounded-lg text-sm text-red-600 dark:text-red-400">
          Error cargando datos: {error}
        </div>
      )}

      {/* ── Summary mini-cards ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-7">
        {[
          {
            label: `Gasto IA (${range})`,
            value: loading ? '—' : fmt$(totalCost),
            sub: `${fmtK(ai?.summary.totalTokens ?? 0)} tokens · ${ai?.summary.totalCalls ?? 0} llamadas`,
            accent: totalCost > 10 ? '#f59e0b' : '#71BF44',
          },
          {
            label: 'n8n Cloud · ejecuciones',
            value: loading ? '—' : n8nExec.toLocaleString(),
            sub: `de ${N8N_STARTER.EXEC.toLocaleString()} / mes · plan Starter $${N8N_STARTER.PRICE}`,
            accent: pctColor(pct(n8nExec, N8N_STARTER.EXEC)),
          },
          {
            label: 'Supabase · base de datos',
            value: loading ? '—' : `${dbMb.toFixed(0)} MB`,
            sub: `de ${SUPABASE_LIMITS.DB_MB} MB · free tier${dbMb > 500 ? ' ⚠ excedido' : ''}`,
            accent: pctColor(pct(dbMb, SUPABASE_LIMITS.DB_MB)),
          },
          {
            label: 'Workflows activos',
            value: loading ? '—' : n8nActiveWf.toString(),
            sub: `Cloud: ${infra?.n8n.primary.activeWorkflows ?? 0} · SARA: ${infra?.n8n.sara.activeWorkflows ?? 0}`,
            accent: '#71BF44',
          },
        ].map(c => (
          <div key={c.label} className="bg-white dark:bg-[#131313] border border-neutral-200 dark:border-neutral-800 rounded-xl p-5 shadow-sm">
            <p className="text-[10px] font-medium text-neutral-400 dark:text-neutral-500 uppercase tracking-wide mb-1">{c.label}</p>
            <p className="text-2xl font-bold" style={{ color: loading ? '#9ca3af' : c.accent }}>{c.value}</p>
            <p className="text-[11px] text-neutral-400 dark:text-neutral-500 mt-1">{c.sub}</p>
          </div>
        ))}
      </div>

      {/* ── Tabs ── */}
      <div className="flex gap-1 bg-neutral-100 dark:bg-neutral-900 p-1 rounded-lg w-fit mb-7 overflow-x-auto">
        <TabBtn label="IA en Tiempo Real" active={tab === 'ia'} onClick={() => setTab('ia')} />
        <TabBtn label="Infraestructura" active={tab === 'infra'} onClick={() => setTab('infra')} />
        <TabBtn label="Proyecciones" active={tab === 'proyecciones'} onClick={() => setTab('proyecciones')} />
        <TabBtn label="Por Origen" active={tab === 'origen'} onClick={() => setTab('origen')} />
      </div>

      {/* ══════════ IA EN TIEMPO REAL ══════════ */}
      {tab === 'ia' && (
        <div className="space-y-6">

          {/* Trend chart */}
          <Card className="p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-base font-semibold text-neutral-900 dark:text-white">Tokens diarios (últimos 30 días)</h3>
              {ai?.trend.length === 0 && (
                <span className="text-xs text-neutral-400">Sin datos — instrumenta n8n para ver datos reales</span>
              )}
            </div>
            {(ai?.trend.length ?? 0) > 0 ? (
              <ResponsiveContainer width="100%" height={200}>
                <LineChart data={ai!.trend} margin={{ top: 4, right: 8, left: -10, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#27272a" />
                  <XAxis dataKey="day" tickFormatter={fmtDate} tick={{ fontSize: 10, fill: '#71717a' }} />
                  <YAxis tickFormatter={v => fmtK(v)} tick={{ fontSize: 10, fill: '#71717a' }} />
                  <Tooltip content={<ChartTooltip formatter={(v: number) => fmtK(v)} />} />
                  <Line type="monotone" dataKey="tokens" stroke="#71BF44" strokeWidth={2} dot={false} name="Tokens" />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-[200px] flex items-center justify-center text-sm text-neutral-400 dark:text-neutral-600 bg-neutral-50 dark:bg-neutral-900/40 rounded-lg">
                Sin datos en <code className="font-mono mx-1">ai_usage</code> para este período
              </div>
            )}
          </Card>

          {/* Cost by model chart */}
          {(ai?.models.length ?? 0) > 0 && (
            <Card className="p-6">
              <h3 className="text-base font-semibold text-neutral-900 dark:text-white mb-4">Costo por modelo ({range})</h3>
              <ResponsiveContainer width="100%" height={Math.max(120, (ai?.models.length ?? 1) * 44)}>
                <BarChart
                  data={ai!.models.map(m => ({ name: modelLabel(m.model), cost: m.costUsd }))}
                  layout="vertical"
                  margin={{ top: 0, right: 40, left: 0, bottom: 0 }}
                >
                  <XAxis type="number" tickFormatter={v => fmt$(v)} tick={{ fontSize: 10, fill: '#71717a' }} />
                  <YAxis type="category" dataKey="name" width={170} tick={{ fontSize: 11, fill: '#a3a3a3' }} />
                  <Tooltip content={<ChartTooltip formatter={(v: number) => fmt$(v)} />} />
                  <Bar dataKey="cost" name="Costo USD" radius={[0, 4, 4, 0]}>
                    {ai!.models.map((_, i) => <Cell key={i} fill={MODEL_COLORS[i % MODEL_COLORS.length]} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </Card>
          )}

          {/* Per-model table */}
          <Card className="overflow-hidden">
            <div className="px-6 py-4 border-b border-neutral-100 dark:border-neutral-800">
              <h3 className="text-base font-semibold text-neutral-900 dark:text-white">Desglose por modelo</h3>
            </div>
            {(ai?.models.length ?? 0) === 0 ? (
              <div className="px-6 py-10 text-center text-sm text-neutral-400">
                <p>Sin datos de uso aún.</p>
                <p className="mt-1 text-xs">Instrumenta los workflows de n8n con el nodo <code className="font-mono">LOG_AI_Usage</code> para ver datos reales.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="text-[11px] text-neutral-500 uppercase bg-neutral-50 dark:bg-neutral-900/50">
                    <tr>
                      <th className="px-5 py-3 text-left font-medium">Modelo</th>
                      <th className="px-5 py-3 text-right font-medium">Tokens input</th>
                      <th className="px-5 py-3 text-right font-medium">Tokens output</th>
                      <th className="px-5 py-3 text-right font-medium">Llamadas</th>
                      <th className="px-5 py-3 text-right font-medium">Costo</th>
                      <th className="px-5 py-3 text-right font-medium">Última vez</th>
                    </tr>
                  </thead>
                  <tbody>
                    {ai!.models.map((m, i) => (
                      <tr key={m.model} className="border-t border-neutral-100 dark:border-neutral-800/60 hover:bg-neutral-50 dark:hover:bg-neutral-800/20">
                        <td className="px-5 py-3">
                          <div className="flex items-center gap-2">
                            <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: MODEL_COLORS[i % MODEL_COLORS.length] }} />
                            <div>
                              <p className="font-medium text-neutral-900 dark:text-white text-[13px]">{modelLabel(m.model)}</p>
                              <p className="text-[11px] text-neutral-400">{m.provider}</p>
                            </div>
                          </div>
                        </td>
                        <td className="px-5 py-3 text-right font-mono text-xs text-neutral-600 dark:text-neutral-400">{fmtK(m.inputTokens)}</td>
                        <td className="px-5 py-3 text-right font-mono text-xs text-neutral-600 dark:text-neutral-400">{fmtK(m.outputTokens)}</td>
                        <td className="px-5 py-3 text-right font-mono text-xs text-neutral-600 dark:text-neutral-400">{m.calls}</td>
                        <td className="px-5 py-3 text-right font-mono text-sm font-semibold text-amber-600 dark:text-amber-400">{fmt$(m.costUsd)}</td>
                        <td className="px-5 py-3 text-right text-xs text-neutral-400">{fmtRelTime(m.lastCall)}</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot className="border-t border-neutral-200 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-900/40">
                    <tr>
                      <td className="px-5 py-3 font-semibold text-neutral-900 dark:text-white text-sm">Total</td>
                      <td className="px-5 py-3 text-right font-mono text-xs text-neutral-700 dark:text-neutral-300">{fmtK(ai?.summary.totalInputTokens ?? 0)}</td>
                      <td className="px-5 py-3 text-right font-mono text-xs text-neutral-700 dark:text-neutral-300">{fmtK(ai?.summary.totalOutputTokens ?? 0)}</td>
                      <td className="px-5 py-3 text-right font-mono text-xs text-neutral-700 dark:text-neutral-300">{ai?.summary.totalCalls ?? 0}</td>
                      <td className="px-5 py-3 text-right font-mono font-bold text-base text-amber-500">{fmt$(totalCost)}</td>
                      <td />
                    </tr>
                  </tfoot>
                </table>
              </div>
            )}
          </Card>

          {/* Pricing reference */}
          {(ai?.pricing.length ?? 0) > 0 && (
            <Card className="overflow-hidden">
              <div className="px-6 py-4 border-b border-neutral-100 dark:border-neutral-800">
                <h3 className="text-base font-semibold text-neutral-900 dark:text-white">Precios configurados en Supabase</h3>
                <p className="text-xs text-neutral-400 mt-0.5">Tabla <code className="font-mono">ai_pricing</code> · el costo se calcula server-side</p>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead className="text-[10px] text-neutral-500 uppercase bg-neutral-50 dark:bg-neutral-900/50">
                    <tr>
                      <th className="px-5 py-2.5 text-left font-medium">Modelo</th>
                      <th className="px-5 py-2.5 text-right font-medium">Input / 1M</th>
                      <th className="px-5 py-2.5 text-right font-medium">Output / 1M</th>
                      <th className="px-5 py-2.5 text-right font-medium">Cached / 1M</th>
                    </tr>
                  </thead>
                  <tbody>
                    {ai!.pricing.map(p => (
                      <tr key={`${p.provider}:${p.model}`} className="border-t border-neutral-100 dark:border-neutral-800/60">
                        <td className="px-5 py-2.5">
                          <p className="font-medium text-neutral-800 dark:text-neutral-200">{modelLabel(p.model)}</p>
                          <p className="text-neutral-400">{p.provider}</p>
                        </td>
                        <td className="px-5 py-2.5 text-right font-mono text-neutral-600 dark:text-neutral-400">${p.inputPer1M.toFixed(2)}</td>
                        <td className="px-5 py-2.5 text-right font-mono text-neutral-600 dark:text-neutral-400">${p.outputPer1M.toFixed(2)}</td>
                        <td className="px-5 py-2.5 text-right font-mono text-neutral-600 dark:text-neutral-400">${p.cachedPer1M.toFixed(2)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          )}

          {/* Crédito Gemini */}
          <Card className="p-6">
            <h3 className="text-sm font-semibold text-neutral-900 dark:text-white mb-3">Crédito Google Cloud ($300)</h3>
            <div className="flex justify-between text-sm mb-1">
              <span className="text-neutral-500">Consumido (estimado real 90 días)</span>
              <span className="font-mono font-semibold text-amber-500">$37.70</span>
            </div>
            <ProgressBar value={37.70} max={GEMINI_CREDIT} />
            <InfoBox variant="neutral">
              Crédito de $300 aplica en Vertex AI / Google AI Studio con billing habilitado. El costo real (última lectura manual: $37.70 en 90 días) será reemplazado por datos automáticos cuando el workflow MON_Costos_Diarios esté activo.
            </InfoBox>
          </Card>
        </div>
      )}

      {/* ══════════ INFRAESTRUCTURA ══════════ */}
      {tab === 'infra' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

          {/* Supabase */}
          <SectionCard
            title="Supabase"
            badge={<Badge label={dbMb > 500 ? '⚠ Excedido' : 'Free Tier'} variant={dbMb > 500 ? 'err' : 'free'} />}
            icon={<IconDatabase />}
          >
            <div className="space-y-3">
              <MetricRow label="Base de datos" val={dbMb} max={SUPABASE_LIMITS.DB_MB} unit="MB" />
              <MetricRow label="File storage" val={infra?.supabase.storageGb !== null ? (infra!.supabase.storageGb! * 1000) : null} max={SUPABASE_LIMITS.STORAGE_GB * 1000} unit="MB" />
              <MetricRow label="Bandwidth / mes" val={infra?.supabase.bandwidthGb !== null ? (infra!.supabase.bandwidthGb! * 1000) : null} max={SUPABASE_LIMITS.BANDWIDTH_GB * 1000} unit="MB" />
              <MetricRow label="Edge Functions / mes" val={infra?.supabase.edgeFn ?? null} max={SUPABASE_LIMITS.EDGE_FN} unit="inv." />
              <MetricRow label="MAU" val={infra?.supabase.mau ?? null} max={SUPABASE_LIMITS.MAU} unit="usuarios" />
            </div>
            <div className="mt-4 bg-neutral-50 dark:bg-neutral-900/50 rounded-lg p-3 text-xs space-y-1 text-neutral-500 dark:text-neutral-400">
              <div className="flex justify-between"><span>Proyectos activos máx.</span><span className="font-mono">2</span></div>
              <div className="flex justify-between"><span>Pausa por inactividad</span><span className="font-mono">7 días</span></div>
              <div className="flex justify-between"><span>Plan Pro</span><span className="font-mono text-blue-500">$25/mes</span></div>
            </div>
            {dbMb > 500 && (
              <InfoBox variant="err">
                DB en {dbMb.toFixed(0)} MB — supera el límite de 500 MB del Free Tier. Revisar <code className="font-mono">zoho_learn_vectors</code> (8,522 filas) o migrar a Pro ($25/mes).
              </InfoBox>
            )}
            {infra?.supabase.storageGb === null && (
              <InfoBox variant="neutral">
                Storage, bandwidth y MAU sin datos. El workflow <code className="font-mono">MON_Costos_Diarios</code> los rellenará diariamente vía Supabase Management API.
              </InfoBox>
            )}
          </SectionCard>

          {/* n8n Cloud */}
          <SectionCard
            title="n8n Cloud"
            badge={<Badge label="Starter · $20/mes" variant="paid" />}
            icon={<IconN8N />}
          >
            <div className="space-y-3">
              <div>
                <div className="flex justify-between text-sm">
                  <span className="text-neutral-600 dark:text-neutral-400">Ejecuciones (últimas 250)</span>
                  <span className="text-xs font-mono text-neutral-700 dark:text-neutral-300">
                    {(infra?.n8n.primary.executions ?? 0).toLocaleString()} / {N8N_STARTER.EXEC.toLocaleString()}
                  </span>
                </div>
                <ProgressBar value={infra?.n8n.primary.executions ?? 0} max={N8N_STARTER.EXEC} />
              </div>
            </div>
            <div className="mt-4 bg-neutral-50 dark:bg-neutral-900/50 rounded-lg p-3 text-xs space-y-1.5">
              <div className="flex justify-between text-neutral-600 dark:text-neutral-400">
                <span>Workflows totales</span><span className="font-mono">{infra?.n8n.primary.totalWorkflows ?? '—'}</span>
              </div>
              <div className="flex justify-between text-neutral-600 dark:text-neutral-400">
                <span>Workflows activos</span><span className="font-mono text-[#71BF44] font-semibold">{infra?.n8n.primary.activeWorkflows ?? '—'}</span>
              </div>
              <div className="flex justify-between text-neutral-600 dark:text-neutral-400">
                <span>Ejecuciones concurrentes máx.</span><span className="font-mono">{N8N_STARTER.CONCURRENT}</span>
              </div>
              <div className="flex justify-between text-neutral-600 dark:text-neutral-400">
                <span>RAM</span><span className="font-mono">{N8N_STARTER.RAM_MIB} MiB</span>
              </div>
              <div className="flex justify-between text-neutral-600 dark:text-neutral-400">
                <span>Conexión API</span>
                <span className={infra?.n8n.primary.connected ? 'text-[#71BF44]' : 'text-red-400'}>
                  {loading ? '…' : infra?.n8n.primary.connected ? 'Conectado ✓' : 'Sin conexión ✗'}
                </span>
              </div>
            </div>
            <div className="mt-3 bg-neutral-50 dark:bg-neutral-900/50 rounded-lg p-3 text-xs">
              <p className="text-[10px] font-semibold text-neutral-400 uppercase tracking-wide mb-2">Plan Pro cuando lo necesites ($50/mes)</p>
              <div className="grid grid-cols-3 gap-2 text-neutral-500 text-center">
                <div><p className="font-mono font-medium text-neutral-700 dark:text-neutral-300">{N8N_PRO.EXEC.toLocaleString()}</p><p>ejecuciones</p></div>
                <div><p className="font-mono font-medium text-neutral-700 dark:text-neutral-300">{N8N_PRO.CONCURRENT}</p><p>concurrentes</p></div>
                <div><p className="font-mono font-medium text-neutral-700 dark:text-neutral-300">1.28 GiB</p><p>RAM</p></div>
              </div>
            </div>
            <InfoBox variant="ok">n8n eliminó el límite de workflows activos en 2025. Solo las ejecuciones mensuales limitan el plan Starter.</InfoBox>
          </SectionCard>

          {/* n8n SARA (OCI) */}
          <SectionCard
            title="n8n SARA · OCI Self-hosted"
            badge={<Badge label="Always Free" variant="testing" />}
            icon={<IconServer />}
          >
            <div className="bg-neutral-50 dark:bg-neutral-900/50 rounded-lg p-3 text-xs space-y-1.5">
              <div className="flex justify-between text-neutral-600 dark:text-neutral-400">
                <span>Tier OCI</span><span className="font-mono">Always Free (permanente)</span>
              </div>
              <div className="flex justify-between text-neutral-600 dark:text-neutral-400">
                <span>Incluye</span><span className="font-mono">2 micro VMs · 200 GB storage</span>
              </div>
              <div className="flex justify-between text-neutral-600 dark:text-neutral-400">
                <span>Workflows activos</span><span className="font-mono text-[#71BF44]">{infra?.n8n.sara.activeWorkflows ?? '—'}</span>
              </div>
              <div className="flex justify-between text-neutral-600 dark:text-neutral-400">
                <span>Ejecuciones (últimas 250)</span><span className="font-mono">{infra?.n8n.sara.executions ?? '—'}</span>
              </div>
              <div className="flex justify-between text-neutral-600 dark:text-neutral-400">
                <span>Conexión API</span>
                <span className={infra?.n8n.sara.connected ? 'text-[#71BF44]' : 'text-red-400'}>
                  {loading ? '…' : infra?.n8n.sara.connected ? 'Conectado ✓' : 'Sin conexión ✗'}
                </span>
              </div>
            </div>
            <InfoBox variant="ok">OCI Always Free es permanente — no vence ni requiere tarjeta activa. Scripts Python SARA corren aquí sin costo.</InfoBox>
          </SectionCard>

          {/* Vercel */}
          <SectionCard
            title="Vercel"
            badge={<Badge label="Hobby · Gratis" variant="free" />}
            icon={<IconVercel />}
          >
            <div className="space-y-3">
              <div>
                <div className="flex justify-between text-sm">
                  <span className="text-neutral-600 dark:text-neutral-400">Bandwidth / mes</span>
                  <span className="text-xs font-mono text-neutral-700 dark:text-neutral-300">
                    {VERCEL_STATIC.BANDWIDTH_GB} / {VERCEL_LIMITS.BANDWIDTH_GB} GB
                  </span>
                </div>
                <ProgressBar value={VERCEL_STATIC.BANDWIDTH_GB} max={VERCEL_LIMITS.BANDWIDTH_GB} />
              </div>
              <div>
                <div className="flex justify-between text-sm">
                  <span className="text-neutral-600 dark:text-neutral-400">Build minutes / mes</span>
                  <span className="text-xs font-mono text-neutral-700 dark:text-neutral-300">
                    {VERCEL_STATIC.BUILD_MINUTES} / {VERCEL_LIMITS.BUILD_MINUTES} min
                  </span>
                </div>
                <ProgressBar value={VERCEL_STATIC.BUILD_MINUTES} max={VERCEL_LIMITS.BUILD_MINUTES} />
              </div>
            </div>
            <div className="mt-4 bg-neutral-50 dark:bg-neutral-900/50 rounded-lg p-3 text-xs space-y-1 text-neutral-500 dark:text-neutral-400">
              <div className="flex justify-between"><span>Serverless functions</span><span className="font-mono">100 GB-hr / mes</span></div>
              <div className="flex justify-between"><span>Deployments</span><span className="font-mono">Ilimitados</span></div>
              <div className="flex justify-between"><span>Plan Pro</span><span className="font-mono text-blue-500">$20/mes por miembro</span></div>
            </div>
            <InfoBox variant="neutral">
              Valores manuales (actualización: 2026-04-22). Para datos en tiempo real, agrega <code className="font-mono">VERCEL_TOKEN</code> y <code className="font-mono">VERCEL_TEAM_ID</code> al <code className="font-mono">.env.local</code>.
            </InfoBox>
            <InfoBox variant="warn">El plan Hobby prohíbe uso comercial. Si el proyecto genera ingresos, migrar a Pro.</InfoBox>
          </SectionCard>
        </div>
      )}

      {/* ══════════ PROYECCIONES ══════════ */}
      {tab === 'proyecciones' && (
        <div className="space-y-6">

          {/* Assumptions */}
          <Card className="p-5">
            <p className="text-[10px] font-semibold text-neutral-400 uppercase tracking-wide mb-3">Supuestos (regresión lineal · tasa actual)</p>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 text-xs">
              {[
                { label: 'Promedio diario IA', value: fmt$(avgDailyCost) },
                { label: 'Proyección mensual IA', value: fmt$(projMonthCost) },
                { label: 'n8n Cloud (fijo)', value: `$${N8N_STARTER.PRICE}/mes` },
                { label: 'Total estimado / año', value: `$${projYearCost.toFixed(0)}` },
              ].map(s => (
                <div key={s.label}>
                  <span className="block text-neutral-400 dark:text-neutral-500 mb-0.5">{s.label}</span>
                  <span className="font-semibold text-neutral-700 dark:text-neutral-300">{s.value}</span>
                </div>
              ))}
            </div>
            {trendDays === 0 && (
              <InfoBox variant="warn">Sin datos de tendencia — las proyecciones se muestran con costo IA = $0. Instrumenta n8n para obtener proyecciones reales.</InfoBox>
            )}
          </Card>

          {/* Bar chart 6 months */}
          <Card className="p-6">
            <h3 className="text-base font-semibold text-neutral-900 dark:text-white mb-5">Distribución proyectada · próximos 6 meses</h3>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={projRows} margin={{ top: 4, right: 8, left: -10, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#27272a" />
                <XAxis dataKey="label" tick={{ fontSize: 11, fill: '#71717a' }} />
                <YAxis tickFormatter={v => `$${v}`} tick={{ fontSize: 10, fill: '#71717a' }} />
                <Tooltip content={<ChartTooltip formatter={(v: number) => `$${v.toFixed(2)}`} />} />
                <Bar dataKey="n8n" stackId="a" fill="#3b82f6" name="n8n Cloud" />
                <Bar dataKey="ai" stackId="a" fill="#f59e0b" name="Gemini/IA" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
            <div className="flex gap-4 mt-3 text-xs text-neutral-400">
              <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-sm bg-blue-400/70 inline-block" />n8n Cloud (fijo $20)</span>
              <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-sm bg-amber-400/80 inline-block" />Gemini / IA (variable)</span>
              <span className="flex items-center gap-1.5 text-[#71BF44]">✦ Supabase · Vercel · OCI gratis</span>
            </div>
          </Card>

          {/* Projection table */}
          <Card className="overflow-hidden">
            <div className="px-6 py-4 border-b border-neutral-100 dark:border-neutral-800">
              <h3 className="text-base font-semibold text-neutral-900 dark:text-white">Gasto proyectado mes a mes</h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="text-xs text-neutral-500 uppercase bg-neutral-50 dark:bg-neutral-900/50">
                  <tr>
                    <th className="px-6 py-3 text-left font-medium">Mes</th>
                    <th className="px-6 py-3 text-right font-medium">IA (Gemini)</th>
                    <th className="px-6 py-3 text-right font-medium">n8n Cloud</th>
                    <th className="px-6 py-3 text-right font-medium">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {projRows.map((r, i) => (
                    <tr key={r.label} className={`border-t border-neutral-100 dark:border-neutral-800/60 ${i === 0 ? 'bg-[#71BF44]/5' : 'hover:bg-neutral-50 dark:hover:bg-neutral-800/20'}`}>
                      <td className="px-6 py-3 font-medium text-neutral-900 dark:text-white">
                        {r.label}{i === 0 && <span className="ml-2 text-[10px] text-[#71BF44] font-semibold">actual</span>}
                      </td>
                      <td className="px-6 py-3 text-right font-mono text-xs text-amber-600 dark:text-amber-400">{fmt$(r.ai)}</td>
                      <td className="px-6 py-3 text-right font-mono text-xs text-blue-500">${r.n8n}</td>
                      <td className="px-6 py-3 text-right font-mono font-semibold text-neutral-900 dark:text-white">${r.total.toFixed(2)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>

          {/* Upgrade thresholds */}
          <Card className="p-6">
            <h3 className="text-base font-semibold text-neutral-900 dark:text-white mb-4">¿Cuándo necesito actualizar?</h3>
            <div className="space-y-2.5">
              {[
                {
                  service: 'n8n Cloud → Pro ($50/mes)',
                  trigger: 'Superar 2,500 ejecuciones/mes',
                  val: infra?.n8n.primary.executions ?? 0,
                  max: N8N_STARTER.EXEC,
                  detail: `${infra?.n8n.primary.executions ?? 0} ejecuciones registradas (últimas 250)`,
                },
                {
                  service: 'Supabase → Pro ($25/mes)',
                  trigger: 'DB >500 MB, bandwidth >5 GB o MAU >50k',
                  val: dbMb,
                  max: SUPABASE_LIMITS.DB_MB,
                  detail: `DB ${dbMb.toFixed(0)} MB / 500 MB`,
                },
                {
                  service: 'Vercel → Pro ($20/mes · comercial)',
                  trigger: 'Uso comercial o bandwidth >100 GB',
                  val: VERCEL_STATIC.BANDWIDTH_GB,
                  max: VERCEL_LIMITS.BANDWIDTH_GB,
                  detail: `${VERCEL_STATIC.BANDWIDTH_GB} GB / 100 GB bandwidth`,
                },
                {
                  service: 'Gemini — agotamiento crédito Google',
                  trigger: 'Consumir los $300 de crédito',
                  val: 37.70,
                  max: GEMINI_CREDIT,
                  detail: '$37.70 consumido de $300 (últimos 90 días, fuente: Google AI Studio)',
                },
              ].map(item => {
                const p = pct(item.val, item.max);
                const color = pctColor(p);
                const label = p > 85 ? 'Urgente' : p > 60 ? 'Vigilar' : 'OK';
                return (
                  <div key={item.service} className="flex items-start gap-4 p-3 bg-neutral-50 dark:bg-neutral-900/50 rounded-lg">
                    <span className="text-xs font-bold mt-0.5 w-14 flex-shrink-0" style={{ color }}>{label}</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-neutral-800 dark:text-neutral-200">{item.service}</p>
                      <p className="text-xs text-neutral-500">{item.trigger}</p>
                      <p className="text-xs text-neutral-400 font-mono mt-0.5">{item.detail}</p>
                      <div className="mt-2"><ProgressBar value={item.val} max={item.max} small /></div>
                    </div>
                    <span className="text-xs font-mono font-semibold w-12 text-right flex-shrink-0" style={{ color }}>{p.toFixed(1)}%</span>
                  </div>
                );
              })}
            </div>
          </Card>
        </div>
      )}

      {/* ══════════ POR ORIGEN ══════════ */}
      {tab === 'origen' && (
        <div className="space-y-6">

          {/* Source bar chart */}
          {(ai?.sources.length ?? 0) > 0 && (
            <Card className="p-6">
              <h3 className="text-base font-semibold text-neutral-900 dark:text-white mb-4">Costo por workflow / origen ({range})</h3>
              <ResponsiveContainer width="100%" height={Math.max(120, (ai?.sources.length ?? 1) * 44)}>
                <BarChart
                  data={ai!.sources.map(s => ({ name: s.source, cost: s.costUsd }))}
                  layout="vertical"
                  margin={{ top: 0, right: 40, left: 0, bottom: 0 }}
                >
                  <XAxis type="number" tickFormatter={v => fmt$(v)} tick={{ fontSize: 10, fill: '#71717a' }} />
                  <YAxis type="category" dataKey="name" width={200} tick={{ fontSize: 11, fill: '#a3a3a3' }} />
                  <Tooltip content={<ChartTooltip formatter={(v: number) => fmt$(v)} />} />
                  <Bar dataKey="cost" name="Costo USD" fill="#71BF44" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </Card>
          )}

          {/* Source table */}
          <Card className="overflow-hidden">
            <div className="px-6 py-4 border-b border-neutral-100 dark:border-neutral-800">
              <h3 className="text-base font-semibold text-neutral-900 dark:text-white">Desglose por origen</h3>
              <p className="text-xs text-neutral-400 mt-0.5">Campo <code className="font-mono">source</code> en tabla <code className="font-mono">ai_usage</code></p>
            </div>
            {(ai?.sources.length ?? 0) === 0 ? (
              <div className="px-6 py-10 text-center text-sm text-neutral-400">
                <p>Sin datos por origen aún.</p>
                <p className="mt-1 text-xs">El campo <code className="font-mono">source</code> se rellena automáticamente cuando se instrumentan los workflows n8n.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="text-[11px] text-neutral-500 uppercase bg-neutral-50 dark:bg-neutral-900/50">
                    <tr>
                      <th className="px-5 py-3 text-left font-medium">Origen</th>
                      <th className="px-5 py-3 text-right font-medium">Tokens input</th>
                      <th className="px-5 py-3 text-right font-medium">Tokens output</th>
                      <th className="px-5 py-3 text-right font-medium">Llamadas</th>
                      <th className="px-5 py-3 text-right font-medium">Costo</th>
                      <th className="px-5 py-3 text-right font-medium">% total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {ai!.sources.map((s, i) => {
                      const p = totalCost > 0 ? (s.costUsd / totalCost) * 100 : 0;
                      return (
                        <tr key={s.source} className="border-t border-neutral-100 dark:border-neutral-800/60 hover:bg-neutral-50 dark:hover:bg-neutral-800/20">
                          <td className="px-5 py-3">
                            <div className="flex items-center gap-2">
                              <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: MODEL_COLORS[i % MODEL_COLORS.length] }} />
                              <code className="font-mono text-[13px] text-neutral-800 dark:text-neutral-200">{s.source}</code>
                            </div>
                          </td>
                          <td className="px-5 py-3 text-right font-mono text-xs text-neutral-600 dark:text-neutral-400">{fmtK(s.inputTokens)}</td>
                          <td className="px-5 py-3 text-right font-mono text-xs text-neutral-600 dark:text-neutral-400">{fmtK(s.outputTokens)}</td>
                          <td className="px-5 py-3 text-right font-mono text-xs text-neutral-600 dark:text-neutral-400">{s.calls}</td>
                          <td className="px-5 py-3 text-right font-mono text-sm font-semibold text-amber-600 dark:text-amber-400">{fmt$(s.costUsd)}</td>
                          <td className="px-5 py-3 text-right">
                            <div className="flex items-center justify-end gap-2">
                              <div className="w-16 h-1.5 bg-neutral-100 dark:bg-neutral-800 rounded-full overflow-hidden">
                                <div className="h-full rounded-full" style={{ width: `${p}%`, background: MODEL_COLORS[i % MODEL_COLORS.length] }} />
                              </div>
                              <span className="font-mono text-xs text-neutral-500 w-8 text-right">{p.toFixed(0)}%</span>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </Card>

          {/* Source guide */}
          <Card className="p-5">
            <p className="text-[10px] font-semibold text-neutral-400 uppercase tracking-wide mb-3">Valores configurados por flujo</p>
            <div className="space-y-1.5 text-xs font-mono">
              {[
                ['n8n:MAIN', 'CerebroSatcom (sX1vK56dW_pyFCjJn-0Ll)'],
                ['n8n:SUB_RAG', 'SUB_Consulta_RAG_V2 (F2RkG7AUQ7AcfVxB)'],
                ['n8n:SUB_ESTADO', 'SUB_SetEstadoChat (kBhEsrQGq8XipJ7z8W5wV)'],
                ['n8n:SUB_IMAGEN', 'SUB_IngestaDeImagenes (XuHh3EVfuppgVCX7LjU9D)'],
                ['n8n:CAMPANAS', 'MAIN_Campañas (94mF5FQ92rYh2h0w)'],
                ['script:sara_pdf_ingest', 'SARA — ingestión de PDFs'],
                ['script:zoho_learn_ingest', 'SARA — ingestión Zoho Learn'],
              ].map(([src, desc]) => (
                <div key={src} className="flex gap-3 text-neutral-500 dark:text-neutral-400">
                  <span className="text-[#71BF44] flex-shrink-0">{src}</span>
                  <span className="text-neutral-400">{desc}</span>
                </div>
              ))}
            </div>
          </Card>
        </div>
      )}

      <p className="mt-8 text-xs text-neutral-400 dark:text-neutral-600 text-center">
        Datos en tiempo real vía <code className="font-mono">/api/usage</code> · Supabase + n8n Cloud API · actualización automática cada 60 s
        {lastUpdated && ` · último fetch ${lastUpdated.toLocaleTimeString('es-MX')}`}
      </p>
    </>
  );
}

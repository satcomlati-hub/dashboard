'use client';
import { useState, useEffect } from 'react';

// ─── Types ────────────────────────────────────────────────────────────────────
interface Metrics {
  totalExecutions: number;
  activeWorkflows: number;
  geminiTokens: number;
  instances: { n8n: number; sara: number };
  connection: { sara: boolean; primary: boolean; connected: number; total: number };
}

// ─── Gemini — precios verificados en ai.google.dev/gemini-api/docs/pricing ───
// (abril 2026)
const GEMINI_MODELS = {
  'gemini-2.0-flash': {
    label: 'Gemini 2.0 Flash',
    inputPer1M: 0.10,
    outputPer1M: 0.40,
    deprecated: true,
    note: 'Da de baja el 1 jun 2026 — migrar a 2.5 Flash-Lite',
  },
  'gemini-2.5-flash-lite': {
    label: 'Gemini 2.5 Flash-Lite',
    inputPer1M: 0.10,
    outputPer1M: 0.40,
    deprecated: false,
    note: 'Opción más económica activa',
  },
  'gemini-2.5-flash': {
    label: 'Gemini 2.5 Flash',
    inputPer1M: 0.30,
    outputPer1M: 2.50,
    deprecated: false,
    note: 'Balance rendimiento/costo',
  },
  'gemini-2.5-pro': {
    label: 'Gemini 2.5 Pro',
    inputPer1M: 1.25,
    outputPer1M: 10.00,
    deprecated: false,
    note: 'Mayor capacidad — costo elevado',
  },
} as const;

type GeminiModelKey = keyof typeof GEMINI_MODELS;

// Suposición de split input/output:
// Workloads de automatización/chatbot típicos = 65% entrada, 35% salida.
// Sin separar conteos en /api/metrics, usamos la tasa combinada.
const INPUT_RATIO = 0.65;
const OUTPUT_RATIO = 0.35;

const GEMINI_CREDIT = 300;

// Costo real reportado por Google AI Studio — últimos 90 días (actualizado 2026-04-02)
// La tabla gemini_usage en Supabase NO recibe datos de producción (solo 1 fila de prueba),
// así que este valor manual es la referencia más confiable.
const GEMINI_STUDIO_COST_90D = 37.70;

// ─── Supabase Free — verificado en supabase.com/pricing (abril 2026) ─────────
const SUPABASE_LIMITS = {
  DB_MB: 500,
  STORAGE_GB: 1,
  BANDWIDTH_GB: 5,
  MAU: 50_000,
  EDGE_FN: 500_000,
  PROJECTS: 2,
  PAUSE_DAYS: 7,
  PRO_PRICE: 25,
};
// Valores actuales — DB_MB obtenido de pg_database_size() vía Supabase MCP (2026-04-02)
const SUPABASE_USED = { DB_MB: 652, STORAGE_GB: 0.08, BANDWIDTH_GB: 0.4, MAU: 4, EDGE_FN: 1_200 };

// ─── n8n Cloud Starter — verificado en n8n.io/pricing (abril 2026) ───────────
// NOTA: n8n eliminó el límite de workflows activos. Solo importa el nº de ejecuciones.
const N8N_CLOUD = {
  EXEC_MONTH: 2_500,
  CONCURRENT: 5,
  RAM_MiB: 320,
  PRICE_USD: 20,
  PRO_EXEC: 10_000,
  PRO_PRICE: 50,
  PRO_RAM_MiB: 1_280,
  PRO_CONCURRENT: 20,
};

// ─── Vercel Hobby — verificado en vercel.com/pricing (abril 2026) ────────────
const VERCEL_LIMITS = { BANDWIDTH_GB: 100, BUILD_MINUTES: 6_000, FN_GB_HR: 100 };
const VERCEL_USED = { BANDWIDTH_GB: 2.3, BUILD_MINUTES: 52 };

// ─── Helpers ──────────────────────────────────────────────────────────────────
function blendedRatePer1M(model: GeminiModelKey): number {
  const m = GEMINI_MODELS[model];
  return m.inputPer1M * INPUT_RATIO + m.outputPer1M * OUTPUT_RATIO;
}

function getDaysInMonth(d: Date) {
  return new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
}

function monthLabel(offset: number, from: Date) {
  const d = new Date(from.getFullYear(), from.getMonth() + offset, 1);
  return d.toLocaleDateString('es-MX', { month: 'short', year: '2-digit' });
}

// ─── Sub-components ───────────────────────────────────────────────────────────
function ProgressBar({ value, max }: { value: number; max: number }) {
  const pct = Math.min(100, Math.max(0, (value / max) * 100));
  const color = pct > 85 ? '#ef4444' : pct > 60 ? '#f59e0b' : '#71BF44';
  return (
    <div className="mt-1.5">
      <div className="flex justify-between text-[11px] text-neutral-400 dark:text-neutral-500 mb-1">
        <span>{pct.toFixed(1)}% usado</span>
        <span>{Math.round(max - value).toLocaleString()} libres</span>
      </div>
      <div className="h-1.5 bg-neutral-100 dark:bg-neutral-800 rounded-full overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-500"
          style={{ width: `${Math.max(pct, 0.3)}%`, background: color }}
        />
      </div>
    </div>
  );
}

function Badge({ label, variant }: { label: string; variant: 'free' | 'paid' | 'credit' | 'testing' }) {
  const s = {
    free:    'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400',
    paid:    'bg-blue-500/10 text-blue-600 dark:text-blue-400',
    credit:  'bg-amber-500/10 text-amber-600 dark:text-amber-400',
    testing: 'bg-neutral-500/10 text-neutral-500 dark:text-neutral-400',
  };
  return <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${s[variant]}`}>{label}</span>;
}

function ServiceCard({ title, icon, badge, children }: {
  title: string; icon: React.ReactNode; badge: React.ReactNode; children: React.ReactNode;
}) {
  return (
    <div className="bg-white dark:bg-[#131313] border border-neutral-200 dark:border-neutral-800 rounded-xl p-6 shadow-sm">
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
    </div>
  );
}

function InfoBox({ children, variant = 'neutral' }: { children: React.ReactNode; variant?: 'neutral' | 'warn' | 'ok' }) {
  const s = {
    neutral: 'bg-neutral-50 dark:bg-neutral-900/50 border-neutral-200 dark:border-neutral-700 text-neutral-500 dark:text-neutral-400',
    warn:    'bg-amber-500/5 border-amber-500/20 text-amber-700 dark:text-amber-400',
    ok:      'bg-[#71BF44]/5 border-[#71BF44]/20 text-[#4a8a2a] dark:text-[#71BF44]',
  };
  return (
    <div className={`flex items-start gap-2 p-3 border rounded-lg mt-3 ${s[variant]}`}>
      <svg width="14" height="14" className="flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
      <p className="text-xs">{children}</p>
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

// ─── Page ─────────────────────────────────────────────────────────────────────
export default function UsagePage() {
  const [metrics, setMetrics] = useState<Metrics | null>(null);
  const [tab, setTab] = useState<'actual' | 'proyeccion'>('actual');
  const [model, setModel] = useState<GeminiModelKey>('gemini-2.5-flash');
  const [projMonths, setProjMonths] = useState<1 | 3 | 6 | 12>(3);

  const now = new Date();
  const daysInMonth = getDaysInMonth(now);
  const dayOfMonth = now.getDate();

  useEffect(() => {
    fetch('/api/metrics')
      .then(r => r.json())
      .then(d => { if (!d.error) setMetrics(d); })
      .catch(() => {});
  }, []);

  // ── Gemini calculations ──
  const geminiTokens = metrics?.geminiTokens ?? 0;
  const ratePer1M = blendedRatePer1M(model);
  const geminiCostMonth = (geminiTokens / 1_000_000) * ratePer1M;
  const creditPct = Math.min(100, (geminiCostMonth / GEMINI_CREDIT) * 100);
  const creditColor = creditPct > 85 ? '#ef4444' : creditPct > 60 ? '#f59e0b' : '#71BF44';

  // ── n8n ──
  const n8nExec = metrics?.totalExecutions ?? 0;
  const n8nExecPct = Math.min(100, (n8nExec / N8N_CLOUD.EXEC_MONTH) * 100);

  // ── Projections: extrapolate from daily rate ──
  const tokensPerDay = dayOfMonth > 0 ? geminiTokens / dayOfMonth : 0;
  const projTokensMonth = tokensPerDay * daysInMonth;
  const projGeminiMonth = (projTokensMonth / 1_000_000) * ratePer1M;

  const execPerDay = dayOfMonth > 0 ? n8nExec / dayOfMonth : 0;
  const projExecMonth = execPerDay * daysInMonth;

  const projTotalPerMonth = projGeminiMonth + N8N_CLOUD.PRICE_USD;

  const PROJ_MONTHS_OPTIONS: { label: string; v: 1 | 3 | 6 | 12 }[] = [
    { label: '1 mes', v: 1 }, { label: '3 meses', v: 3 },
    { label: '6 meses', v: 6 }, { label: '12 meses', v: 12 },
  ];

  return (
    <>
      <header className="mb-6">
        <h2 className="text-2xl font-bold text-neutral-900 dark:text-[#e5e5e5] tracking-tight">Finanzas y Uso</h2>
        <p className="text-sm text-neutral-500 dark:text-[#ababab] mt-1">
          Costos reales, límites de plan y proyecciones de gasto por herramienta.
        </p>
      </header>

      {/* Tabs */}
      <div className="flex gap-1 bg-neutral-100 dark:bg-neutral-900 p-1 rounded-lg w-fit mb-7">
        <TabBtn label="Estado Actual" active={tab === 'actual'} onClick={() => setTab('actual')} />
        <TabBtn label="Proyecciones" active={tab === 'proyeccion'} onClick={() => setTab('proyeccion')} />
      </div>

      {/* ══════════ ESTADO ACTUAL ══════════ */}
      {tab === 'actual' && (
        <>
          {/* Summary mini-cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
            {[
              { label: 'Gasto fijo mensual', value: '$20', sub: 'n8n Cloud Starter' },
              {
                label: 'Crédito Gemini restante',
                value: `$${(GEMINI_CREDIT - GEMINI_STUDIO_COST_90D).toFixed(2)}`,
                sub: `de $${GEMINI_CREDIT} · ${((GEMINI_STUDIO_COST_90D / GEMINI_CREDIT) * 100).toFixed(2)}% usado (90 días)`,
              },
              {
                label: 'Gemini real (90 días)',
                value: `$${GEMINI_STUDIO_COST_90D.toFixed(2)}`,
                sub: `Fuente: Google AI Studio · tabla local sin datos`,
              },
              { label: 'Servicios gratuitos', value: '3 / 5', sub: 'Supabase · Vercel · OCI' },
            ].map(c => (
              <div key={c.label} className="bg-white dark:bg-[#131313] border border-neutral-200 dark:border-neutral-800 rounded-xl p-5 shadow-sm">
                <p className="text-[10px] font-medium text-neutral-400 dark:text-neutral-500 uppercase tracking-wide mb-1">{c.label}</p>
                <p className="text-2xl font-bold text-neutral-900 dark:text-white">{c.value}</p>
                <p className="text-[11px] text-neutral-400 dark:text-neutral-500 mt-1">{c.sub}</p>
              </div>
            ))}
          </div>

          {/* Service cards */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

            {/* ── Gemini API ── */}
            <ServiceCard
              title="Gemini API"
              badge={<Badge label="Crédito Google $300" variant="credit" />}
              icon={
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" className="text-amber-500">
                  <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              }
            >
              {/* Model selector */}
              <div className="mb-4">
                <label className="text-xs text-neutral-500 dark:text-neutral-400 font-medium block mb-1.5">Modelo en uso</label>
                <select
                  value={model}
                  onChange={e => setModel(e.target.value as GeminiModelKey)}
                  className="w-full text-sm bg-neutral-50 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-700 rounded-lg px-3 py-2 text-neutral-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-[#71BF44]"
                >
                  {(Object.keys(GEMINI_MODELS) as GeminiModelKey[]).map(k => (
                    <option key={k} value={k}>
                      {GEMINI_MODELS[k].label}{GEMINI_MODELS[k].deprecated ? ' ⚠ deprecado' : ''}
                    </option>
                  ))}
                </select>
                <p className="text-[11px] text-neutral-400 dark:text-neutral-500 mt-1">{GEMINI_MODELS[model].note}</p>
              </div>

              {/* Pricing breakdown */}
              <div className="bg-neutral-50 dark:bg-neutral-900/50 rounded-lg p-3 text-xs space-y-1.5 mb-4">
                <p className="text-[10px] font-semibold text-neutral-400 uppercase tracking-wide mb-2">Cómo se calcula el costo</p>
                <div className="flex justify-between text-neutral-600 dark:text-neutral-400">
                  <span>Input (${GEMINI_MODELS[model].inputPer1M.toFixed(2)}/1M × 65%)</span>
                  <span className="font-mono">${(GEMINI_MODELS[model].inputPer1M * INPUT_RATIO).toFixed(4)}/1M</span>
                </div>
                <div className="flex justify-between text-neutral-600 dark:text-neutral-400">
                  <span>Output (${GEMINI_MODELS[model].outputPer1M.toFixed(2)}/1M × 35%)</span>
                  <span className="font-mono">${(GEMINI_MODELS[model].outputPer1M * OUTPUT_RATIO).toFixed(4)}/1M</span>
                </div>
                <div className="flex justify-between font-semibold text-neutral-700 dark:text-neutral-300 border-t border-neutral-200 dark:border-neutral-700 pt-1.5 mt-1">
                  <span>Tasa combinada</span>
                  <span className="font-mono">${ratePer1M.toFixed(4)} / 1M tokens</span>
                </div>
                <div className="flex justify-between text-neutral-600 dark:text-neutral-400">
                  <span>Tokens este mes</span>
                  <span className="font-mono">{geminiTokens.toLocaleString()}</span>
                </div>
                <div className="flex justify-between font-semibold text-neutral-700 dark:text-neutral-300 border-t border-neutral-200 dark:border-neutral-700 pt-1.5 mt-1">
                  <span>Costo estimado</span>
                  <span className="font-mono text-amber-600 dark:text-amber-400">${geminiCostMonth.toFixed(6)}</span>
                </div>
              </div>

              {/* Credit bar */}
              <div>
                <div className="flex justify-between text-sm">
                  <span className="text-neutral-600 dark:text-neutral-400">Crédito consumido</span>
                  <span className="font-medium text-neutral-900 dark:text-neutral-200 text-xs">
                    ${geminiCostMonth.toFixed(4)} / ${GEMINI_CREDIT}
                  </span>
                </div>
                <ProgressBar value={geminiCostMonth} max={GEMINI_CREDIT} />
              </div>

              {/* Real cost from AI Studio */}
              <div className="bg-amber-500/5 border border-amber-500/20 rounded-lg p-3 mt-3">
                <p className="text-[10px] font-semibold text-amber-600 dark:text-amber-400 uppercase tracking-wide mb-2">
                  Costo real · Google AI Studio
                </p>
                <div className="flex justify-between text-xs text-neutral-700 dark:text-neutral-300">
                  <span>Últimos 90 días</span>
                  <span className="font-mono font-semibold text-amber-600 dark:text-amber-400">${GEMINI_STUDIO_COST_90D.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-xs text-neutral-500 dark:text-neutral-400 mt-1">
                  <span>Tracking local (tabla <code className="font-mono">gemini_usage</code>)</span>
                  <span className="font-mono text-red-500">Sin datos reales</span>
                </div>
                <p className="text-[11px] text-amber-700 dark:text-amber-500 mt-2">
                  Los workflows no escriben en la tabla local. El seguimiento por modelo y por tarjeta API requiere instrumentar cada llamada a Gemini para insertar en <code className="font-mono">gemini_usage</code>.
                </p>
              </div>

              {GEMINI_MODELS[model].deprecated && (
                <InfoBox variant="warn">
                  Gemini 2.0 Flash se dará de baja el 1 jun 2026. Migrar a 2.5 Flash-Lite (mismo precio) o 2.5 Flash antes de esa fecha.
                </InfoBox>
              )}
              <InfoBox variant="neutral">
                La tasa combinada asume 65% input / 35% output. El crédito $300 es de Google Cloud — aplica solo si se factura vía Vertex AI o Google AI Studio con billing habilitado.
              </InfoBox>
            </ServiceCard>

            {/* ── Supabase ── */}
            <ServiceCard
              title="Supabase"
              badge={<Badge label="Free Tier" variant="free" />}
              icon={
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" className="text-emerald-500">
                  <path d="M4 7a2 2 0 012-2h12a2 2 0 012 2v10a2 2 0 01-2 2H6a2 2 0 01-2-2V7z" stroke="currentColor" strokeWidth="2"/>
                  <path d="M8 11h8M8 15h5" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                </svg>
              }
            >
              <div className="space-y-3">
                {[
                  { label: 'Base de datos', used: SUPABASE_USED.DB_MB, max: SUPABASE_LIMITS.DB_MB, unit: 'MB' },
                  { label: 'File storage', used: Math.round(SUPABASE_USED.STORAGE_GB * 1000), max: SUPABASE_LIMITS.STORAGE_GB * 1000, unit: 'MB' },
                  { label: 'Bandwidth / mes', used: SUPABASE_USED.BANDWIDTH_GB * 1000, max: SUPABASE_LIMITS.BANDWIDTH_GB * 1000, unit: 'MB' },
                  { label: 'Edge Functions / mes', used: SUPABASE_USED.EDGE_FN, max: SUPABASE_LIMITS.EDGE_FN, unit: 'inv.' },
                  { label: 'MAU', used: SUPABASE_USED.MAU, max: SUPABASE_LIMITS.MAU, unit: 'usuarios' },
                ].map(m => (
                  <div key={m.label}>
                    <div className="flex justify-between text-sm">
                      <span className="text-neutral-600 dark:text-neutral-400">{m.label}</span>
                      <span className="text-xs font-mono text-neutral-700 dark:text-neutral-300">
                        {m.used.toLocaleString()} / {m.max.toLocaleString()} {m.unit}
                      </span>
                    </div>
                    <ProgressBar value={m.used} max={m.max} />
                  </div>
                ))}
              </div>
              <div className="mt-4 bg-neutral-50 dark:bg-neutral-900/50 rounded-lg p-3 text-xs space-y-1 text-neutral-500 dark:text-neutral-400">
                <div className="flex justify-between"><span>Proyectos activos máx.</span><span className="font-mono">2</span></div>
                <div className="flex justify-between"><span>Pausa por inactividad</span><span className="font-mono">7 días</span></div>
                <div className="flex justify-between"><span>Plan Pro (si se supera)</span><span className="font-mono text-blue-500">$25/mes</span></div>
              </div>
              <InfoBox variant="warn">
                DB a 652 MB — supera el límite de 500 MB del Free Tier. Supabase puede pausar o degradar el proyecto. Revisar y limpiar datos (p.ej. <code className="font-mono">zoho_learn_vectors</code> con 8,522 filas) o migrar al plan Pro ($25/mes).
              </InfoBox>
              <InfoBox variant="neutral">DB_MB medido con <code className="font-mono">pg_database_size()</code> vía MCP (2026-04-02). Resto de valores ingresados manualmente.</InfoBox>
            </ServiceCard>

            {/* ── n8n Cloud ── */}
            <ServiceCard
              title="n8n Cloud"
              badge={<Badge label="Starter · $20/mes" variant="paid" />}
              icon={
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" className="text-[#71BF44]">
                  <path d="M13 10V3L4 14h7v7l9-11h-7z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              }
            >
              <div className="space-y-3">
                <div>
                  <div className="flex justify-between text-sm">
                    <span className="text-neutral-600 dark:text-neutral-400">Ejecuciones / mes</span>
                    <span className="text-xs font-mono text-neutral-700 dark:text-neutral-300">
                      {n8nExec.toLocaleString()} / {N8N_CLOUD.EXEC_MONTH.toLocaleString()}
                    </span>
                  </div>
                  <ProgressBar value={Math.min(n8nExec, N8N_CLOUD.EXEC_MONTH)} max={N8N_CLOUD.EXEC_MONTH} />
                </div>
              </div>
              <div className="mt-4 bg-neutral-50 dark:bg-neutral-900/50 rounded-lg p-3 text-xs space-y-1.5">
                <div className="flex justify-between text-neutral-600 dark:text-neutral-400">
                  <span>Workflows activos</span><span className="font-mono text-[#71BF44] font-semibold">Ilimitados ✓</span>
                </div>
                <div className="flex justify-between text-neutral-600 dark:text-neutral-400">
                  <span>Ejecuciones concurrentes</span><span className="font-mono">{N8N_CLOUD.CONCURRENT} máx.</span>
                </div>
                <div className="flex justify-between text-neutral-600 dark:text-neutral-400">
                  <span>RAM</span><span className="font-mono">{N8N_CLOUD.RAM_MiB} MiB</span>
                </div>
                <div className="flex justify-between text-neutral-600 dark:text-neutral-400">
                  <span>Estado API</span>
                  <span className={metrics?.connection.primary ? 'text-[#71BF44]' : 'text-red-400'}>
                    {!metrics ? 'Cargando…' : metrics.connection.primary ? 'Conectado' : 'Sin conexión'}
                  </span>
                </div>
              </div>
              <div className="mt-3 bg-neutral-50 dark:bg-neutral-900/50 rounded-lg p-3 text-xs">
                <p className="text-[10px] font-semibold text-neutral-400 uppercase tracking-wide mb-2">Plan Pro cuando lo necesites ($50/mes)</p>
                <div className="grid grid-cols-3 gap-2 text-neutral-500 dark:text-neutral-500 text-center">
                  <div><p className="font-mono font-medium text-neutral-700 dark:text-neutral-300">10,000</p><p>ejecuciones</p></div>
                  <div><p className="font-mono font-medium text-neutral-700 dark:text-neutral-300">20</p><p>concurrentes</p></div>
                  <div><p className="font-mono font-medium text-neutral-700 dark:text-neutral-300">1.28 GiB</p><p>RAM</p></div>
                </div>
              </div>
              <InfoBox variant="ok">
                n8n eliminó el límite de workflows activos en 2025. Solo las ejecuciones mensuales limitan el plan Starter.
              </InfoBox>
            </ServiceCard>

            {/* ── n8n OCI ── */}
            <ServiceCard
              title="n8n OCI (Self-hosted)"
              badge={<Badge label="Testing · Sin costo" variant="testing" />}
              icon={
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" className="text-neutral-400">
                  <path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              }
            >
              <p className="text-sm text-neutral-500 dark:text-neutral-400 mb-4">
                Instancia self-hosted en Oracle Cloud Infrastructure Always Free. Ambiente de pruebas — sin costo real.
              </p>
              <div className="bg-neutral-50 dark:bg-neutral-900/50 rounded-lg p-3 text-xs space-y-1.5">
                <div className="flex justify-between text-neutral-600 dark:text-neutral-400">
                  <span>Tier OCI</span><span className="font-mono">Always Free (permanente)</span>
                </div>
                <div className="flex justify-between text-neutral-600 dark:text-neutral-400">
                  <span>Incluye</span><span className="font-mono">2 micro VMs · 200 GB storage</span>
                </div>
                <div className="flex justify-between text-neutral-600 dark:text-neutral-400">
                  <span>Workflows activos (SARA)</span><span className="font-mono">{metrics?.instances.sara ?? '—'}</span>
                </div>
                <div className="flex justify-between text-neutral-600 dark:text-neutral-400">
                  <span>Estado conexión</span>
                  <span className={metrics?.connection.sara ? 'text-[#71BF44]' : 'text-red-400'}>
                    {!metrics ? 'Cargando…' : metrics.connection.sara ? 'Conectado' : 'Sin conexión'}
                  </span>
                </div>
              </div>
              <InfoBox variant="ok">OCI Always Free es permanente — no vence ni requiere tarjeta activa.</InfoBox>
            </ServiceCard>

            {/* ── Vercel ── */}
            <ServiceCard
              title="Vercel"
              badge={<Badge label="Hobby · Gratis" variant="free" />}
              icon={
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" className="text-neutral-900 dark:text-white">
                  <path d="M12 2L2 19.8h20L12 2z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              }
            >
              <div className="space-y-3">
                <div>
                  <div className="flex justify-between text-sm">
                    <span className="text-neutral-600 dark:text-neutral-400">Bandwidth / mes</span>
                    <span className="text-xs font-mono text-neutral-700 dark:text-neutral-300">
                      {VERCEL_USED.BANDWIDTH_GB} / {VERCEL_LIMITS.BANDWIDTH_GB} GB
                    </span>
                  </div>
                  <ProgressBar value={VERCEL_USED.BANDWIDTH_GB} max={VERCEL_LIMITS.BANDWIDTH_GB} />
                </div>
                <div>
                  <div className="flex justify-between text-sm">
                    <span className="text-neutral-600 dark:text-neutral-400">Build minutes / mes</span>
                    <span className="text-xs font-mono text-neutral-700 dark:text-neutral-300">
                      {VERCEL_USED.BUILD_MINUTES} / {VERCEL_LIMITS.BUILD_MINUTES} min
                    </span>
                  </div>
                  <ProgressBar value={VERCEL_USED.BUILD_MINUTES} max={VERCEL_LIMITS.BUILD_MINUTES} />
                </div>
              </div>
              <div className="mt-4 bg-neutral-50 dark:bg-neutral-900/50 rounded-lg p-3 text-xs space-y-1 text-neutral-500 dark:text-neutral-400">
                <div className="flex justify-between"><span>Serverless functions</span><span className="font-mono">{VERCEL_LIMITS.FN_GB_HR} GB-hr / mes</span></div>
                <div className="flex justify-between"><span>Deployments</span><span className="font-mono">Ilimitados</span></div>
                <div className="flex justify-between"><span>Dominios custom</span><span className="font-mono">Incluidos</span></div>
                <div className="flex justify-between"><span>Plan Pro (si se supera)</span><span className="font-mono text-blue-500">$20/mes por miembro</span></div>
              </div>
              <InfoBox variant="warn">
                El plan Hobby prohíbe uso comercial. Si el proyecto factura o genera ingresos, migrar al plan Pro.
              </InfoBox>
            </ServiceCard>

          </div>
        </>
      )}

      {/* ══════════ PROYECCIONES ══════════ */}
      {tab === 'proyeccion' && (
        <>
          {/* Period tabs */}
          <div className="flex items-center gap-3 mb-6">
            <span className="text-sm text-neutral-500 dark:text-neutral-400">Proyectar a:</span>
            <div className="flex gap-1 bg-neutral-100 dark:bg-neutral-900 p-1 rounded-lg">
              {PROJ_MONTHS_OPTIONS.map(o => (
                <TabBtn key={o.v} label={o.label} active={projMonths === o.v} onClick={() => setProjMonths(o.v)} />
              ))}
            </div>
          </div>

          {/* Assumptions */}
          <div className="bg-neutral-50 dark:bg-neutral-900/50 border border-neutral-200 dark:border-neutral-800 rounded-xl p-4 mb-6">
            <p className="text-[10px] font-semibold text-neutral-400 uppercase tracking-wide mb-3">Supuestos de proyección</p>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 text-xs">
              {[
                { label: 'Crecimiento', value: 'Lineal (tasa actual)' },
                { label: 'Modelo Gemini', value: GEMINI_MODELS[model].label },
                { label: 'Tokens/día est.', value: tokensPerDay.toFixed(0) },
                { label: 'Ejecuciones/día est.', value: execPerDay.toFixed(1) },
              ].map(s => (
                <div key={s.label}>
                  <span className="block text-neutral-400 dark:text-neutral-500 mb-0.5">{s.label}</span>
                  <span className="font-medium text-neutral-700 dark:text-neutral-300">{s.value}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Projection table */}
          <div className="bg-white dark:bg-[#131313] border border-neutral-200 dark:border-neutral-800 rounded-xl overflow-hidden shadow-sm mb-6">
            <div className="px-6 py-4 border-b border-neutral-100 dark:border-neutral-800">
              <h3 className="text-base font-semibold text-neutral-900 dark:text-white">
                Gasto proyectado · próximos {projMonths} {projMonths === 1 ? 'mes' : 'meses'}
              </h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="text-xs text-neutral-500 uppercase bg-neutral-50 dark:bg-neutral-900/50">
                  <tr>
                    <th className="px-6 py-3 text-left font-medium">Servicio</th>
                    <th className="px-6 py-3 text-left font-medium">Plan</th>
                    <th className="px-6 py-3 text-right font-medium">Mensual</th>
                    <th className="px-6 py-3 text-right font-medium">{projMonths} {projMonths === 1 ? 'mes' : 'meses'}</th>
                    <th className="px-6 py-3 text-center font-medium">Estado</th>
                  </tr>
                </thead>
                <tbody>
                  {[
                    {
                      name: 'Gemini API',
                      plan: GEMINI_MODELS[model].label,
                      monthly: projGeminiMonth,
                      total: projGeminiMonth * projMonths,
                      status: projGeminiMonth * projMonths > 50
                        ? { label: 'Vigilar', color: '#f59e0b' }
                        : { label: 'OK', color: '#71BF44' },
                    },
                    {
                      name: 'n8n Cloud',
                      plan: 'Starter',
                      monthly: N8N_CLOUD.PRICE_USD,
                      total: N8N_CLOUD.PRICE_USD * projMonths,
                      status: n8nExecPct > 85
                        ? { label: 'Cerca del límite', color: '#ef4444' }
                        : { label: 'Fijo', color: '#71BF44' },
                    },
                    { name: 'Supabase', plan: 'Free', monthly: 0, total: 0, status: { label: 'OK', color: '#71BF44' } },
                    { name: 'Vercel', plan: 'Hobby', monthly: 0, total: 0, status: { label: 'OK', color: '#71BF44' } },
                    { name: 'n8n OCI', plan: 'Always Free', monthly: 0, total: 0, status: { label: 'Sin costo', color: '#71BF44' } },
                  ].map(row => (
                    <tr key={row.name} className="border-b border-neutral-100 dark:border-neutral-800/50 hover:bg-neutral-50 dark:hover:bg-neutral-800/20 transition-colors">
                      <td className="px-6 py-4 font-medium text-neutral-900 dark:text-white">{row.name}</td>
                      <td className="px-6 py-4 text-xs font-mono text-neutral-500">{row.plan}</td>
                      <td className="px-6 py-4 text-right font-mono text-neutral-900 dark:text-white">
                        {row.monthly > 0 ? `$${row.monthly.toFixed(2)}` : '—'}
                      </td>
                      <td className="px-6 py-4 text-right font-mono font-semibold text-neutral-900 dark:text-white">
                        ${row.total.toFixed(2)}
                      </td>
                      <td className="px-6 py-4 text-center">
                        <span className="text-xs font-semibold" style={{ color: row.status.color }}>{row.status.label}</span>
                      </td>
                    </tr>
                  ))}
                  <tr className="bg-neutral-50 dark:bg-neutral-900/60 font-bold">
                    <td className="px-6 py-4 text-neutral-900 dark:text-white" colSpan={2}>TOTAL ESTIMADO</td>
                    <td className="px-6 py-4 text-right font-mono text-neutral-900 dark:text-white">
                      ${projTotalPerMonth.toFixed(2)}
                    </td>
                    <td className="px-6 py-4 text-right font-mono text-[#71BF44] text-base">
                      ${(projTotalPerMonth * projMonths).toFixed(2)}
                    </td>
                    <td />
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          {/* Visual bar chart */}
          <div className="bg-white dark:bg-[#131313] border border-neutral-200 dark:border-neutral-800 rounded-xl p-6 shadow-sm mb-6">
            <h3 className="text-base font-semibold text-neutral-900 dark:text-white mb-5">Distribución mensual</h3>
            <div className="space-y-3">
              {Array.from({ length: projMonths }, (_, i) => {
                const isCurrentMonth = i === 0;
                const geminiThisMonth = isCurrentMonth ? geminiCostMonth : projGeminiMonth;
                const total = geminiThisMonth + N8N_CLOUD.PRICE_USD;
                const maxBar = Math.max(projTotalPerMonth * 1.2, N8N_CLOUD.PRICE_USD + 1);
                const n8nW = (N8N_CLOUD.PRICE_USD / maxBar) * 100;
                const gemW = (geminiThisMonth / maxBar) * 100;
                const label = monthLabel(i, now);
                return (
                  <div key={i} className="flex items-center gap-3">
                    <span className="text-xs text-neutral-400 font-mono w-10 text-right">{label}</span>
                    {isCurrentMonth && (
                      <span className="text-[10px] text-[#71BF44] font-medium w-8">actual</span>
                    )}
                    {!isCurrentMonth && <span className="w-8" />}
                    <div className="flex-1 h-5 bg-neutral-100 dark:bg-neutral-800 rounded overflow-hidden">
                      <div className="h-full flex">
                        <div className="h-full bg-blue-400/70" style={{ width: `${n8nW}%` }} title={`n8n $${N8N_CLOUD.PRICE_USD}`} />
                        <div className="h-full bg-amber-400/80" style={{ width: `${gemW}%` }} title={`Gemini $${geminiThisMonth.toFixed(4)}`} />
                      </div>
                    </div>
                    <span className="text-xs font-mono text-neutral-600 dark:text-neutral-400 w-14 text-right">${total.toFixed(2)}</span>
                  </div>
                );
              })}
            </div>
            <div className="flex gap-4 mt-4 text-xs text-neutral-400">
              <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-sm bg-blue-400/70 inline-block" />n8n Cloud (fijo)</span>
              <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-sm bg-amber-400/80 inline-block" />Gemini API (variable)</span>
            </div>
          </div>

          {/* Upgrade thresholds */}
          <div className="bg-white dark:bg-[#131313] border border-neutral-200 dark:border-neutral-800 rounded-xl p-6 shadow-sm">
            <h3 className="text-base font-semibold text-neutral-900 dark:text-white mb-4">¿Cuándo necesito actualizar?</h3>
            <div className="space-y-3">
              {[
                {
                  service: 'n8n Cloud → Pro ($50/mes)',
                  trigger: 'Superar 2,500 ejecuciones/mes',
                  pct: n8nExecPct,
                  detail: `${n8nExec.toLocaleString()} / 2,500 exec · proyección mes: ${Math.round(projExecMonth).toLocaleString()}`,
                },
                {
                  service: 'Supabase → Pro ($25/mes)',
                  trigger: 'DB >500 MB, bandwidth >5 GB o MAU >50k',
                  pct: Math.max(
                    (SUPABASE_USED.DB_MB / SUPABASE_LIMITS.DB_MB) * 100,
                    (SUPABASE_USED.BANDWIDTH_GB / SUPABASE_LIMITS.BANDWIDTH_GB) * 100
                  ),
                  detail: `DB ${SUPABASE_USED.DB_MB}/${SUPABASE_LIMITS.DB_MB} MB · BW ${SUPABASE_USED.BANDWIDTH_GB}/${SUPABASE_LIMITS.BANDWIDTH_GB} GB`,
                },
                {
                  service: 'Vercel → Pro ($20/mes)',
                  trigger: 'Uso comercial o bandwidth >100 GB',
                  pct: (VERCEL_USED.BANDWIDTH_GB / VERCEL_LIMITS.BANDWIDTH_GB) * 100,
                  detail: `${VERCEL_USED.BANDWIDTH_GB}/${VERCEL_LIMITS.BANDWIDTH_GB} GB bandwidth`,
                },
                {
                  service: 'Gemini — agotamiento crédito',
                  trigger: 'Consumir los $300 de crédito Google',
                  pct: creditPct,
                  detail: `$${geminiCostMonth.toFixed(4)} consumido · ${(GEMINI_CREDIT - geminiCostMonth).toFixed(2)} restantes`,
                },
              ].map(item => {
                const color = item.pct > 85 ? '#ef4444' : item.pct > 60 ? '#f59e0b' : '#71BF44';
                const label = item.pct > 85 ? 'Urgente' : item.pct > 60 ? 'Vigilar' : 'OK';
                return (
                  <div key={item.service} className="flex items-start gap-4 p-3 bg-neutral-50 dark:bg-neutral-900/50 rounded-lg">
                    <span className="text-xs font-bold mt-0.5 min-w-[44px]" style={{ color }}>{label}</span>
                    <div className="flex-1">
                      <p className="text-sm font-medium text-neutral-800 dark:text-neutral-200">{item.service}</p>
                      <p className="text-xs text-neutral-500">{item.trigger}</p>
                      <p className="text-xs text-neutral-400 font-mono mt-0.5">{item.detail}</p>
                    </div>
                    <span className="text-xs font-mono font-semibold min-w-[44px] text-right" style={{ color }}>
                      {item.pct.toFixed(1)}%
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        </>
      )}

      <p className="mt-6 text-xs text-neutral-400 dark:text-neutral-600 text-center">
        Límites verificados en fuentes oficiales · abril 2026.
        Supabase y Vercel: valores manuales · n8n y Gemini: tiempo real vía <code className="font-mono">/api/metrics</code>.
      </p>
    </>
  );
}

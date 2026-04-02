'use client';
import { useState, useEffect } from 'react';

interface Metrics {
  totalExecutions: number;
  activeWorkflows: number;
  geminiTokens: number;
  instances: { n8n: number; sara: number };
  connection: { sara: boolean; primary: boolean; connected: number; total: number };
}

// Precios Gemini Flash (input/output blended ~$0.15/1M tokens)
const GEMINI_PRICE_PER_1M = 0.15;
// Crédito inicial Google
const GEMINI_CREDIT = 300;

// Límites Supabase Free
const SUPABASE_DB_LIMIT_MB = 500;
const SUPABASE_STORAGE_LIMIT_GB = 1;
const SUPABASE_BANDWIDTH_LIMIT_GB = 5;
const SUPABASE_MAU_LIMIT = 50_000;

// Valores actuales Supabase (actualizar manualmente hasta integrar API)
const SUPABASE_DB_USED_MB = 48;
const SUPABASE_STORAGE_USED_GB = 0.08;
const SUPABASE_BANDWIDTH_USED_GB = 0.4;
const SUPABASE_MAU_USED = 4;

// Límites n8n Cloud Starter
const N8N_EXEC_LIMIT = 2_500;
const N8N_WORKFLOW_LIMIT = 5;

// Límites Vercel Hobby
const VERCEL_BANDWIDTH_LIMIT_GB = 100;
const VERCEL_BUILD_MINUTES_LIMIT = 6_000;

// Valores actuales Vercel (actualizar manualmente hasta integrar API)
const VERCEL_BANDWIDTH_USED_GB = 2.3;
const VERCEL_BUILD_MINUTES_USED = 52;

function ProgressBar({ value, max }: { value: number; max: number }) {
  const pct = Math.min(100, (value / max) * 100);
  const color = pct > 85 ? '#ef4444' : pct > 60 ? '#f59e0b' : '#71BF44';
  return (
    <div className="mt-2">
      <div className="flex justify-between text-xs text-neutral-500 dark:text-neutral-400 mb-1">
        <span>{value.toLocaleString()}</span>
        <span>{((pct)).toFixed(1)}%</span>
      </div>
      <div className="h-1.5 bg-neutral-100 dark:bg-neutral-800 rounded-full overflow-hidden">
        <div className="h-full rounded-full transition-all duration-500" style={{ width: `${pct}%`, background: color }} />
      </div>
    </div>
  );
}

function Badge({ label, variant }: { label: string; variant: 'free' | 'paid' | 'credit' | 'testing' }) {
  const styles = {
    free:    'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400',
    paid:    'bg-blue-500/10 text-blue-600 dark:text-blue-400',
    credit:  'bg-amber-500/10 text-amber-600 dark:text-amber-400',
    testing: 'bg-neutral-500/10 text-neutral-500 dark:text-neutral-400',
  };
  return (
    <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${styles[variant]}`}>
      {label}
    </span>
  );
}

function ServiceCard({ title, icon, badge, children }: {
  title: string;
  icon: React.ReactNode;
  badge: React.ReactNode;
  children: React.ReactNode;
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

function MetricRow({ label, value, limit, unit, children }: {
  label: string;
  value: number;
  limit: number;
  unit: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="mb-4 last:mb-0">
      <div className="flex items-center justify-between">
        <span className="text-sm text-neutral-600 dark:text-neutral-400">{label}</span>
        <span className="text-sm font-medium text-neutral-900 dark:text-neutral-200">
          {value.toLocaleString()} / {limit.toLocaleString()} {unit}
        </span>
      </div>
      <ProgressBar value={value} max={limit} />
      {children}
    </div>
  );
}

export default function UsagePage() {
  const [metrics, setMetrics] = useState<Metrics | null>(null);

  useEffect(() => {
    fetch('/api/metrics')
      .then(r => r.json())
      .then(data => { if (!data.error) setMetrics(data); })
      .catch(() => {});
  }, []);

  const geminiTokens = metrics?.geminiTokens ?? 0;
  const geminiCostUSD = (geminiTokens / 1_000_000) * GEMINI_PRICE_PER_1M;
  const geminiCreditPct = Math.min(100, (geminiCostUSD / GEMINI_CREDIT) * 100);
  const geminiCreditColor = geminiCreditPct > 85 ? '#ef4444' : geminiCreditPct > 60 ? '#f59e0b' : '#71BF44';

  const n8nExecUsed = metrics?.totalExecutions ?? 0;
  const n8nWorkflowsUsed = metrics?.instances.n8n ?? 0;

  return (
    <>
      <header className="mb-8">
        <h2 className="text-2xl font-bold text-neutral-900 dark:text-[#e5e5e5] tracking-tight">Finanzas y Uso</h2>
        <p className="text-sm text-neutral-500 dark:text-[#ababab] mt-1">
          Control de costos, límites de plan y consumo por herramienta.
        </p>
      </header>

      {/* Summary cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <div className="bg-white dark:bg-[#131313] border border-neutral-200 dark:border-neutral-800 rounded-xl p-5 shadow-sm">
          <p className="text-xs text-neutral-500 dark:text-neutral-400 mb-1 font-medium uppercase tracking-wide">Gasto mensual est.</p>
          <p className="text-2xl font-bold text-neutral-900 dark:text-white">~$20</p>
          <p className="text-xs text-neutral-400 dark:text-neutral-500 mt-1">n8n Cloud Starter</p>
        </div>
        <div className="bg-white dark:bg-[#131313] border border-neutral-200 dark:border-neutral-800 rounded-xl p-5 shadow-sm">
          <p className="text-xs text-neutral-500 dark:text-neutral-400 mb-1 font-medium uppercase tracking-wide">Crédito Gemini</p>
          <p className="text-2xl font-bold text-neutral-900 dark:text-white">
            ${(GEMINI_CREDIT - geminiCostUSD).toFixed(2)}
          </p>
          <p className="text-xs text-neutral-400 dark:text-neutral-500 mt-1">de ${GEMINI_CREDIT} restantes</p>
        </div>
        <div className="bg-white dark:bg-[#131313] border border-neutral-200 dark:border-neutral-800 rounded-xl p-5 shadow-sm">
          <p className="text-xs text-neutral-500 dark:text-neutral-400 mb-1 font-medium uppercase tracking-wide">Servicios activos</p>
          <p className="text-2xl font-bold text-neutral-900 dark:text-white">5</p>
          <p className="text-xs text-neutral-400 dark:text-neutral-500 mt-1">3 gratuitos · 1 pagado · 1 testing</p>
        </div>
        <div className="bg-white dark:bg-[#131313] border border-neutral-200 dark:border-neutral-800 rounded-xl p-5 shadow-sm">
          <p className="text-xs text-neutral-500 dark:text-neutral-400 mb-1 font-medium uppercase tracking-wide">Próxima renovación</p>
          <p className="text-2xl font-bold text-neutral-900 dark:text-white">n8n</p>
          <p className="text-xs text-neutral-400 dark:text-neutral-500 mt-1">Cloud · mensual</p>
        </div>
      </div>

      {/* Services grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

        {/* Gemini API */}
        <ServiceCard
          title="Gemini API"
          badge={<Badge label="Crédito Google $300" variant="credit" />}
          icon={
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" className="text-amber-500">
              <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          }
        >
          <div className="space-y-4">
            <div className="mb-4">
              <div className="flex items-center justify-between">
                <span className="text-sm text-neutral-600 dark:text-neutral-400">Crédito consumido</span>
                <span className="text-sm font-medium text-neutral-900 dark:text-neutral-200">
                  ${geminiCostUSD.toFixed(4)} / ${GEMINI_CREDIT}
                </span>
              </div>
              <div className="mt-2">
                <div className="flex justify-between text-xs text-neutral-500 dark:text-neutral-400 mb-1">
                  <span>{geminiTokens.toLocaleString()} tokens</span>
                  <span>{geminiCreditPct.toFixed(4)}%</span>
                </div>
                <div className="h-1.5 bg-neutral-100 dark:bg-neutral-800 rounded-full overflow-hidden">
                  <div className="h-full rounded-full transition-all duration-500" style={{ width: `${geminiCreditPct}%`, background: geminiCreditColor }} />
                </div>
              </div>
            </div>

            <div className="bg-neutral-50 dark:bg-neutral-900/50 rounded-lg p-3 text-xs space-y-1.5">
              <div className="flex justify-between text-neutral-600 dark:text-neutral-400">
                <span>Modelo principal</span>
                <span className="font-mono">gemini-flash</span>
              </div>
              <div className="flex justify-between text-neutral-600 dark:text-neutral-400">
                <span>Precio estimado</span>
                <span className="font-mono">~$0.15 / 1M tokens</span>
              </div>
              <div className="flex justify-between text-neutral-600 dark:text-neutral-400">
                <span>Fuente de datos</span>
                <span className={metrics ? 'text-[#71BF44]' : 'text-neutral-400'}>{metrics ? 'API en tiempo real' : 'Sin conexión'}</span>
              </div>
            </div>

            <div className="flex items-start gap-2 p-3 bg-amber-500/5 border border-amber-500/20 rounded-lg">
              <svg width="14" height="14" className="text-amber-500 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <p className="text-xs text-amber-700 dark:text-amber-400">
                Al agotarse el crédito pasará a cobro por uso. No hay límite fijo —
                el costo escala con el volumen de tokens.
              </p>
            </div>
          </div>
        </ServiceCard>

        {/* Supabase */}
        <ServiceCard
          title="Supabase"
          badge={<Badge label="Free Tier" variant="free" />}
          icon={
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" className="text-emerald-500">
              <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          }
        >
          <div className="space-y-1">
            <MetricRow label="Base de datos" value={SUPABASE_DB_USED_MB} limit={SUPABASE_DB_LIMIT_MB} unit="MB" />
            <MetricRow label="Storage" value={parseFloat((SUPABASE_STORAGE_USED_GB * 1000).toFixed(0))} limit={SUPABASE_STORAGE_LIMIT_GB * 1000} unit="MB" />
            <MetricRow label="Bandwidth mensual" value={parseFloat((SUPABASE_BANDWIDTH_USED_GB * 1000).toFixed(0))} limit={SUPABASE_BANDWIDTH_LIMIT_GB * 1000} unit="MB" />
            <MetricRow label="Usuarios activos (MAU)" value={SUPABASE_MAU_USED} limit={SUPABASE_MAU_LIMIT} unit="usuarios" />
          </div>

          <div className="mt-4 flex items-start gap-2 p-3 bg-neutral-50 dark:bg-neutral-900/50 rounded-lg">
            <svg width="14" height="14" className="text-neutral-400 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <p className="text-xs text-neutral-500 dark:text-neutral-400">
              Proyectos inactivos por más de 7 días se pausan automáticamente.
              Valores actuales ingresados manualmente — sin API conectada aún.
            </p>
          </div>
        </ServiceCard>

        {/* n8n Cloud */}
        <ServiceCard
          title="n8n Cloud"
          badge={<Badge label="Starter · ~$20/mes" variant="paid" />}
          icon={
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" className="text-[#71BF44]">
              <path d="M13 10V3L4 14h7v7l9-11h-7z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          }
        >
          <div className="space-y-1">
            <div className="mb-4">
              <div className="flex items-center justify-between">
                <span className="text-sm text-neutral-600 dark:text-neutral-400">Ejecuciones (totales registradas)</span>
                <span className="text-sm font-medium text-neutral-900 dark:text-neutral-200">
                  {n8nExecUsed.toLocaleString()} / {N8N_EXEC_LIMIT.toLocaleString()}
                </span>
              </div>
              <ProgressBar value={Math.min(n8nExecUsed, N8N_EXEC_LIMIT)} max={N8N_EXEC_LIMIT} />
              <p className="text-xs text-neutral-400 mt-1">* n8n Cloud reinicia el contador mensualmente</p>
            </div>

            <div className="mb-4">
              <div className="flex items-center justify-between">
                <span className="text-sm text-neutral-600 dark:text-neutral-400">Workflows activos (instancia cloud)</span>
                <span className="text-sm font-medium text-neutral-900 dark:text-neutral-200">
                  {n8nWorkflowsUsed} / {N8N_WORKFLOW_LIMIT}
                </span>
              </div>
              <ProgressBar value={n8nWorkflowsUsed} max={N8N_WORKFLOW_LIMIT} />
            </div>
          </div>

          <div className="bg-neutral-50 dark:bg-neutral-900/50 rounded-lg p-3 text-xs space-y-1.5 mt-4">
            <div className="flex justify-between text-neutral-600 dark:text-neutral-400">
              <span>Plan siguiente (Pro)</span>
              <span className="font-mono">~$50/mes</span>
            </div>
            <div className="flex justify-between text-neutral-600 dark:text-neutral-400">
              <span>Límites Pro</span>
              <span className="font-mono">10k ejec · 15 workflows</span>
            </div>
            <div className="flex justify-between text-neutral-600 dark:text-neutral-400">
              <span>Estado API</span>
              <span className={metrics?.connection.primary ? 'text-[#71BF44]' : 'text-red-400'}>
                {metrics?.connection.primary ? 'Conectado' : metrics ? 'Sin conexión' : 'Cargando…'}
              </span>
            </div>
          </div>
        </ServiceCard>

        {/* n8n OCI */}
        <ServiceCard
          title="n8n OCI (Self-hosted)"
          badge={<Badge label="Testing · Sin costo" variant="testing" />}
          icon={
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" className="text-neutral-400">
              <path d="M5 12H3l9-9 9 9h-2M5 12v7a2 2 0 002 2h10a2 2 0 002-2v-7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          }
        >
          <p className="text-sm text-neutral-500 dark:text-neutral-400 mb-5">
            Instancia self-hosted en Oracle Cloud Infrastructure. Ambiente de pruebas —
            no genera costos reales. Los recursos de OCI Always Free cubren esta instancia.
          </p>

          <div className="bg-neutral-50 dark:bg-neutral-900/50 rounded-lg p-3 text-xs space-y-1.5">
            <div className="flex justify-between text-neutral-600 dark:text-neutral-400">
              <span>Proveedor</span>
              <span className="font-mono">Oracle Cloud (OCI)</span>
            </div>
            <div className="flex justify-between text-neutral-600 dark:text-neutral-400">
              <span>Tier OCI</span>
              <span className="font-mono">Always Free</span>
            </div>
            <div className="flex justify-between text-neutral-600 dark:text-neutral-400">
              <span>Workflows activos (SARA)</span>
              <span className="font-mono">{metrics?.instances.sara ?? '—'}</span>
            </div>
            <div className="flex justify-between text-neutral-600 dark:text-neutral-400">
              <span>Estado conexión</span>
              <span className={metrics?.connection.sara ? 'text-[#71BF44]' : 'text-red-400'}>
                {metrics?.connection.sara ? 'Conectado' : metrics ? 'Sin conexión' : 'Cargando…'}
              </span>
            </div>
          </div>

          <div className="mt-4 flex items-start gap-2 p-3 bg-neutral-50 dark:bg-neutral-900/50 rounded-lg border border-neutral-200 dark:border-neutral-800">
            <svg width="14" height="14" className="text-[#71BF44] flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <p className="text-xs text-neutral-500 dark:text-neutral-400">
              No requiere suscripción. OCI Always Free incluye 2 micro VMs + 200 GB storage permanentemente.
            </p>
          </div>
        </ServiceCard>

        {/* Vercel */}
        <ServiceCard
          title="Vercel"
          badge={<Badge label="Hobby · Gratis" variant="free" />}
          icon={
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" className="text-neutral-900 dark:text-white">
              <path d="M12 2L2 19.8h20L12 2z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          }
        >
          <div className="space-y-1">
            <MetricRow label="Bandwidth mensual" value={parseFloat((VERCEL_BANDWIDTH_USED_GB).toFixed(1))} limit={VERCEL_BANDWIDTH_LIMIT_GB} unit="GB" />
            <MetricRow label="Build minutes" value={VERCEL_BUILD_MINUTES_USED} limit={VERCEL_BUILD_MINUTES_LIMIT} unit="min" />
          </div>

          <div className="bg-neutral-50 dark:bg-neutral-900/50 rounded-lg p-3 text-xs space-y-1.5 mt-4">
            <div className="flex justify-between text-neutral-600 dark:text-neutral-400">
              <span>Deployments</span>
              <span className="font-mono">Ilimitados (Hobby)</span>
            </div>
            <div className="flex justify-between text-neutral-600 dark:text-neutral-400">
              <span>Funciones serverless</span>
              <span className="font-mono">100 GB-hr / mes</span>
            </div>
            <div className="flex justify-between text-neutral-600 dark:text-neutral-400">
              <span>Dominios custom</span>
              <span className="font-mono">Incluidos</span>
            </div>
            <div className="flex justify-between text-neutral-600 dark:text-neutral-400">
              <span>Valores actuales</span>
              <span className="text-neutral-400">Ingresados manualmente</span>
            </div>
          </div>

          <div className="mt-4 flex items-start gap-2 p-3 bg-amber-500/5 border border-amber-500/20 rounded-lg">
            <svg width="14" height="14" className="text-amber-500 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <p className="text-xs text-amber-700 dark:text-amber-400">
              El plan Hobby no permite uso comercial. Si el proyecto escala a producción
              comercial, se requiere el plan Pro (~$20/mes por miembro).
            </p>
          </div>
        </ServiceCard>

      </div>

      <p className="mt-6 text-xs text-neutral-400 dark:text-neutral-600 text-center">
        Los valores de Supabase y Vercel son estimaciones manuales. La integración con sus APIs de billing está pendiente.
        Los datos de Gemini y n8n se actualizan en tiempo real desde <code className="font-mono">/api/metrics</code>.
      </p>
    </>
  );
}

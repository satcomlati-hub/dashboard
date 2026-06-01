import Link from 'next/link';

const API_URL = (process.env.AGENTES_API_URL ?? 'http://localhost:8080').replace(/\/$/, '');
const API_TOKEN = process.env.AGENTES_API_TOKEN ?? '';
const HEADERS = { Authorization: `Bearer ${API_TOKEN}` };

const RUNS_LIMIT = 30;

type TraceItem = {
  type: 'tool_call' | 'tool_result';
  name: string;
  args?: string;
  result?: string;
  error?: string | null;
  is_error?: boolean;
};

async function getRuns(agentId: string) {
  try {
    const res = await fetch(
      `${API_URL}/v1/runs?agent_id=${agentId}&limit=${RUNS_LIMIT}`,
      { headers: HEADERS, cache: 'no-store' },
    );
    if (!res.ok) return [];
    return res.json();
  } catch {
    return [];
  }
}

async function getAgent(agentId: string) {
  try {
    const res = await fetch(`${API_URL}/v1/agents/${agentId}`, {
      headers: HEADERS, cache: 'no-store',
    });
    if (!res.ok) return null;
    return res.json();
  } catch { return null; }
}

async function getTrace(runId: string): Promise<TraceItem[]> {
  try {
    const res = await fetch(`${API_URL}/v1/runs/${runId}/messages`, {
      headers: HEADERS, cache: 'no-store',
    });
    if (!res.ok) return [];
    const msgs = await res.json();
    if (!Array.isArray(msgs)) return [];
    const assistant = msgs.find((m: any) => m.role === 'assistant');
    const trace = assistant?.metadata?.trace;
    return Array.isArray(trace) ? trace : [];
  } catch { return []; }
}

const STATUS_COLORS: Record<string, string> = {
  completed: 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400',
  error: 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400',
  running: 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400',
  cancelled: 'bg-neutral-100 dark:bg-neutral-800 text-neutral-500',
};

function ToolTrace({ trace }: { trace: TraceItem[] }) {
  if (!trace.length) return null;
  const calls = trace.filter((t) => t.type === 'tool_call').length;
  const errors = trace.filter((t) => t.type === 'tool_result' && t.is_error).length;
  return (
    <details className="mt-3 group">
      <summary className="text-xs cursor-pointer select-none text-[#71BF44] hover:underline flex items-center gap-2">
        <span>Traza de tools · {calls} llamada{calls === 1 ? '' : 's'}</span>
        {errors > 0 && (
          <span className="text-red-500 font-medium">{errors} con error</span>
        )}
      </summary>
      <div className="mt-2 space-y-2 border-l-2 border-neutral-200 dark:border-neutral-800 pl-3">
        {trace.map((t, i) => {
          if (t.type === 'tool_call') {
            return (
              <div key={i} className="text-xs">
                <div className="font-mono font-medium text-neutral-700 dark:text-neutral-300">
                  ▶ {t.name}
                </div>
                {t.args && (
                  <pre className="mt-0.5 whitespace-pre-wrap break-words text-[11px] text-neutral-500 dark:text-neutral-400 bg-neutral-50 dark:bg-neutral-900/60 rounded p-1.5">
                    {t.args}
                  </pre>
                )}
              </div>
            );
          }
          return (
            <div key={i} className="text-xs">
              <div className={`font-mono font-medium ${t.is_error ? 'text-red-600 dark:text-red-400' : 'text-green-700 dark:text-green-400'}`}>
                {t.is_error ? '✖' : '✔'} {t.name}
              </div>
              <pre className={`mt-0.5 whitespace-pre-wrap break-words text-[11px] rounded p-1.5 ${t.is_error ? 'text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20' : 'text-neutral-500 dark:text-neutral-400 bg-neutral-50 dark:bg-neutral-900/60'}`}>
                {t.is_error ? (t.error || 'error') : (t.result ?? '')}
              </pre>
            </div>
          );
        })}
      </div>
    </details>
  );
}

export default async function RunsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [agent, runs] = await Promise.all([getAgent(id), getRuns(id)]);
  const traces: TraceItem[][] = await Promise.all(
    (runs as any[]).map((r) => getTrace(r.id)),
  );

  return (
    <>
      <header className="mb-8">
        <div className="flex items-center gap-2 mb-2">
          <Link href={`/projects/agentes/${id}`} className="text-sm text-[#71BF44] hover:underline flex items-center gap-1">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            {agent?.name ?? 'Agente'}
          </Link>
        </div>
        <h2 className="text-2xl font-bold text-neutral-900 dark:text-[#e5e5e5] tracking-tight">Historial de invocaciones</h2>
        <p className="text-sm text-neutral-500 dark:text-[#ababab] mt-1">
          Últimas {runs.length} ejecuciones del agente. Abre &quot;Traza de tools&quot; para ver qué herramienta se llamó y qué devolvió.
        </p>
      </header>

      {runs.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <p className="text-neutral-400 text-sm">Sin invocaciones aún.</p>
          <Link href={`/projects/agentes/${id}/playground`} className="mt-2 text-sm text-[#71BF44] hover:underline">
            Probar en el playground →
          </Link>
        </div>
      ) : (
        <div className="space-y-3">
          {(runs as any[]).map((run: any, idx: number) => (
            <div
              key={run.id}
              className="bg-white dark:bg-[#131313] border border-neutral-200 dark:border-neutral-800 rounded-xl p-4"
            >
              <div className="flex items-start justify-between mb-2">
                <div className="flex items-center gap-2">
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_COLORS[run.status] ?? STATUS_COLORS.cancelled}`}>
                    {run.status}
                  </span>
                  <span className="text-xs text-neutral-400">{run.source}</span>
                  {run.duration_ms && (
                    <span className="text-xs text-neutral-400">{run.duration_ms}ms</span>
                  )}
                </div>
                <span className="text-xs text-neutral-400">
                  {run.created_at ? new Date(run.created_at).toLocaleString('es-MX') : ''}
                </span>
              </div>
              <p className="text-sm font-medium text-neutral-800 dark:text-neutral-200 truncate mb-1">
                {run.prompt}
              </p>
              {run.response && (
                <p className="text-sm text-neutral-500 dark:text-neutral-400 line-clamp-2">
                  {run.response}
                </p>
              )}
              {run.error && (
                <p className="text-xs text-red-500 mt-1">{run.error}</p>
              )}
              <ToolTrace trace={traces[idx] ?? []} />
            </div>
          ))}
        </div>
      )}
    </>
  );
}

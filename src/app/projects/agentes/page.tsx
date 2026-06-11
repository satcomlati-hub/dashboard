import Link from 'next/link';
import AgentesNav from '@/components/agentes/AgentesNav';
import AgentsGrid from '@/components/agentes/AgentsGrid';
import { delegateTargetId } from '@/lib/agentes';

const API_URL = (process.env.AGENTES_API_URL ?? 'http://localhost:8080').replace(/\/$/, '');
const API_TOKEN = process.env.AGENTES_API_TOKEN ?? '';

async function getJson(path: string) {
  try {
    const res = await fetch(`${API_URL}${path}`, {
      headers: { Authorization: `Bearer ${API_TOKEN}` },
      cache: 'no-store',
    });
    if (!res.ok) return [];
    return res.json();
  } catch {
    return [];
  }
}

export default async function AgentesPage() {
  const [agents, tools]: [any[], any[]] = await Promise.all([
    getJson('/v1/agents'),
    getJson('/v1/http-tools'),
  ]);
  // Agentes que son destino de alguna delegate-tool = subagentes.
  const subagentIds = new Set(
    (Array.isArray(tools) ? tools : [])
      .map((t: any) => delegateTargetId(t.url))
      .filter(Boolean) as string[],
  );

  return (
    <>
      <header className="mb-8 flex items-start justify-between">
        <div>
          <div className="flex items-center gap-2 mb-2">
            <Link href="/projects" className="text-sm text-[#71BF44] hover:underline flex items-center gap-1">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
              Proyectos
            </Link>
          </div>
          <h2 className="text-2xl font-bold text-neutral-900 dark:text-[#e5e5e5] tracking-tight">Agentes IA</h2>
          <p className="text-sm text-neutral-500 dark:text-[#ababab] mt-1">
            Agentes Antigravity con skills, tools MCP y permisos independientes.
          </p>
        </div>
        <Link
          href="/projects/agentes/new"
          className="flex items-center gap-2 bg-[#71BF44] hover:bg-[#5ea832] text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Nuevo agente
        </Link>
      </header>

      <AgentesNav />

      {agents.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <div className="w-16 h-16 rounded-full bg-[#71BF44]/10 flex items-center justify-center mb-4">
            <svg className="w-8 h-8 text-[#71BF44]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
            </svg>
          </div>
          <p className="text-neutral-500 dark:text-neutral-400 text-sm">No hay agentes aún.</p>
          <Link href="/projects/agentes/new" className="mt-3 text-sm text-[#71BF44] hover:underline">
            Crear el primero →
          </Link>
        </div>
      ) : (
        <AgentsGrid agents={agents} subagentIds={[...subagentIds]} />
      )}
    </>
  );
}

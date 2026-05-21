import Link from 'next/link';

const API_URL = (process.env.AGENTES_API_URL ?? 'http://localhost:8080').replace(/\/$/, '');
const API_TOKEN = process.env.AGENTES_API_TOKEN ?? '';

async function getAgents() {
  try {
    const res = await fetch(`${API_URL}/v1/agents`, {
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
  const agents: any[] = await getAgents();

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
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {agents.map((agent: any) => (
            <Link
              key={agent.id}
              href={`/projects/agentes/${agent.id}`}
              className="group bg-white dark:bg-[#131313] border border-neutral-200 dark:border-neutral-800 rounded-xl p-6 shadow-sm hover:border-[#71BF44] transition-all"
            >
              <div className="flex items-start justify-between mb-3">
                <div className="w-10 h-10 rounded-lg bg-[#71BF44]/10 flex items-center justify-center group-hover:bg-[#71BF44]/20 transition-colors">
                  <svg className="w-5 h-5 text-[#71BF44]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                  </svg>
                </div>
                <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                  agent.enabled
                    ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400'
                    : 'bg-neutral-100 dark:bg-neutral-800 text-neutral-500'
                }`}>
                  {agent.enabled ? 'Activo' : 'Inactivo'}
                </span>
              </div>
              <h3 className="text-base font-bold text-neutral-900 dark:text-white mb-1">{agent.name}</h3>
              <p className="text-xs text-neutral-500 dark:text-neutral-400 line-clamp-2 mb-3">
                {agent.description ?? agent.identity}
              </p>
              <div className="flex items-center gap-3 text-xs text-neutral-400">
                <span className="flex items-center gap-1">
                  <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 3H5a2 2 0 00-2 2v4m6-6h10a2 2 0 012 2v4M9 3v18m0 0h10a2 2 0 002-2V9M9 21H5a2 2 0 01-2-2V9m0 0h18" />
                  </svg>
                  {agent.model ?? 'gemini-3.5-flash'}
                </span>
              </div>
            </Link>
          ))}
        </div>
      )}
    </>
  );
}

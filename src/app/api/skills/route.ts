import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';

// Lee/gestiona skills directo de Supabase (pool DATABASE_URL, service-level).
// Evita el endpoint del backend agentes-api /v1/skills, que está devolviendo
// vacío en el editor. Mismo proyecto (ag_skills / ag_agent_skills).
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// GET /api/skills             -> todas las skills
// GET /api/skills?agentId=..  -> skills asignadas a ese agente
export async function GET(req: NextRequest) {
  const agentId = req.nextUrl.searchParams.get('agentId');
  try {
    if (agentId) {
      const r = await query(
        `select s.id, s.slug, s.name, s.description
           from public.ag_skills s
           join public.ag_agent_skills l on l.skill_id = s.id
          where l.agent_id = $1
          order by s.name`,
        [agentId],
      );
      return NextResponse.json(r.rows);
    }
    const r = await query(
      `select id, slug, name, description from public.ag_skills order by name`,
    );
    return NextResponse.json(r.rows);
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

// POST /api/skills  body: { agentId, skillId, action: 'assign' | 'unassign' }
export async function POST(req: NextRequest) {
  let body: { agentId?: string; skillId?: string; action?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'JSON inválido' }, { status: 400 });
  }
  const { agentId, skillId, action } = body;
  if (!agentId || !skillId) {
    return NextResponse.json({ error: 'agentId y skillId requeridos' }, { status: 400 });
  }
  try {
    if (action === 'unassign') {
      await query(
        `delete from public.ag_agent_skills where agent_id = $1 and skill_id = $2`,
        [agentId, skillId],
      );
    } else {
      await query(
        `insert into public.ag_agent_skills (agent_id, skill_id)
         select $1, $2
         where not exists (
           select 1 from public.ag_agent_skills where agent_id = $1 and skill_id = $2
         )`,
        [agentId, skillId],
      );
    }
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

import { NextResponse } from 'next/server';

const SARA_HOST = process.env.N8N_SARA_HOST;
const SARA_JWT = process.env.N8N_SARA_JWT;
const PRIMARY_HOST = process.env.N8N_PRIMARY_HOST;
const PRIMARY_JWT = process.env.N8N_PRIMARY_JWT;

const cleanHost = (url: string) => url.endsWith('/') ? url.slice(0, -1) : url;

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { searchParams } = new URL(request.url);
  const source = searchParams.get('source');
  const { id } = await params;

  console.log(`Fetching detail for workflow ${id} from source: ${source}`);

  const rawHost = source === 'SARA' ? SARA_HOST : PRIMARY_HOST;
  const jwt = source === 'SARA' ? SARA_JWT : PRIMARY_JWT;

  if (!rawHost || !jwt) {
     return NextResponse.json({ error: 'Missing configuration for source' }, { status: 500 });
  }

  const host = cleanHost(rawHost);

  try {
    // 1. Fetch Full Workflow
    const workflowRes = await fetch(`${host}/api/v1/workflows/${id}`, {
      headers: { 'X-N8N-API-KEY': jwt!, 'Accept': 'application/json' }
    });
    
    if (!workflowRes.ok) throw new Error('Workflow not found');
    const workflow = await workflowRes.json();

    // 2. Extract Dependencies
    const credentials = new Set<string>();
    workflow.nodes?.forEach((node: any) => {
      if (node.credentials) {
        Object.keys(node.credentials).forEach(credType => {
           const credName = node.credentials[credType].name || credType;
           credentials.add(credName);
        });
      }
    });

    // 3. Fetch Execution count
    const executionsRes = await fetch(`${host}/api/v1/executions?workflowId=${id}&limit=1`, {
      headers: { 'X-N8N-API-KEY': jwt!, 'Accept': 'application/json' }
    });
    const execData = await executionsRes.json();

    return NextResponse.json({
      id: workflow.id,
      name: workflow.name,
      active: workflow.active,
      executions: execData.count || execData.data?.length || 0,
      dependencies: Array.from(credentials),
      nodesCount: workflow.nodes?.length || 0,
      createdAt: workflow.createdAt,
      updatedAt: workflow.updatedAt
    });
  } catch (error) {
    console.error('Workflow Detail error:', error);
    return NextResponse.json({ error: 'Failed' }, { status: 500 });
  }
}

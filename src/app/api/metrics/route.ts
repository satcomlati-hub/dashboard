import { NextResponse } from 'next/server';

const SARA_HOST = process.env.N8N_SARA_HOST;
const SARA_JWT = process.env.N8N_SARA_JWT;
const PRIMARY_HOST = process.env.N8N_PRIMARY_HOST;
const PRIMARY_JWT = process.env.N8N_PRIMARY_JWT;
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY;
const N8N_EXEC_LIMIT = parseInt(process.env.N8N_EXEC_LIMIT || '250', 10);

const cleanHost = (url: string) => url ? (url.endsWith('/') ? url.slice(0, -1) : url) : '';

export async function GET() {
  try {
    const fetchCount = async (host: string, jwt: string, source: string): Promise<{ count: number; connected: boolean }> => {
        if (!host || !jwt) return { count: 0, connected: false };
        try {
            const res = await fetch(`${cleanHost(host)}/api/v1/executions?limit=${N8N_EXEC_LIMIT}`, {
                headers: { 'X-N8N-API-KEY': jwt, 'Accept': 'application/json' }
            });
            if (!res.ok) {
                console.error(`Executions fetch failed for ${source}: ${res.status}`);
                return { count: 0, connected: false };
            }
            const data = await res.json();
            const count = Array.isArray(data.data) ? data.data.length : 0;
            return { count, connected: true };
        } catch {
            return { count: 0, connected: false };
        }
    };

    const fetchWorkflowsMetrics = async (host: string, jwt: string): Promise<{ total: number; active: number; connected: boolean }> => {
        if (!host || !jwt) return { total: 0, active: 0, connected: false };
        try {
            const res = await fetch(`${cleanHost(host)}/api/v1/workflows?limit=${N8N_EXEC_LIMIT}`, {
                headers: { 'X-N8N-API-KEY': jwt, 'Accept': 'application/json' }
            });
            if (!res.ok) return { total: 0, active: 0, connected: false };
            const data = await res.json();
            const workflows = Array.isArray(data.data) ? data.data : [];
            return {
                total: workflows.length,
                active: workflows.filter((w: any) => w.active === true).length,
                connected: true,
            };
        } catch {
            return { total: 0, active: 0, connected: false };
        }
    };

    const [saraExecsResult, primaryExecsResult, saraWks, primaryWks] = await Promise.all([
        fetchCount(SARA_HOST!, SARA_JWT!, 'SARA'),
        fetchCount(PRIMARY_HOST!, PRIMARY_JWT!, 'PRIMARY'),
        fetchWorkflowsMetrics(SARA_HOST!, SARA_JWT!),
        fetchWorkflowsMetrics(PRIMARY_HOST!, PRIMARY_JWT!)
    ]);

    const saraExecs = saraExecsResult.count;
    const primaryExecs = primaryExecsResult.count;

    const supabaseRes = await fetch(`${SUPABASE_URL}/rest/v1/gemini_usage?select=total_tokens`, {
      headers: {
        'apikey': SUPABASE_ANON_KEY!,
        'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
        'Content-Type': 'application/json'
      }
    });

    let geminiTokens = 0;
    if (supabaseRes.ok) {
        const usageData = await supabaseRes.json();
        geminiTokens = usageData.reduce((acc: number, curr: any) => acc + (curr.total_tokens || 0), 0);
    }

    const connectedCount = [saraWks.connected, primaryWks.connected].filter(Boolean).length;

    return NextResponse.json({
      totalExecutions: saraExecs + primaryExecs,
      activeWorkflows: saraWks.active + primaryWks.active,
      geminiTokens,
      instances: {
        n8n: primaryWks.active,
        sara: saraWks.active,
      },
      connection: {
        sara: saraWks.connected,
        primary: primaryWks.connected,
        connected: connectedCount,
        total: 2,
      },
    });

  } catch (error) {
    console.error('Metrics API error:', error);
    return NextResponse.json({ error: 'Failed' }, { status: 500 });
  }
}

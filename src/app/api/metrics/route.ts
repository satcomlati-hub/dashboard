import { NextResponse } from 'next/server';

const SARA_HOST = process.env.N8N_SARA_HOST;
const SARA_JWT = process.env.N8N_SARA_JWT;
const PRIMARY_HOST = process.env.N8N_PRIMARY_HOST;
const PRIMARY_JWT = process.env.N8N_PRIMARY_JWT;
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY;

const cleanHost = (url: string) => url ? (url.endsWith('/') ? url.slice(0, -1) : url) : '';

export async function GET() {
  try {
    const fetchCount = async (host: string, jwt: string, source: string) => {
        // Fetch executions - using 250 as a safe high limit for n8n API v1
        const res = await fetch(`${cleanHost(host)}/api/v1/executions?limit=250`, {
            headers: { 'X-N8N-API-KEY': jwt, 'Accept': 'application/json' }
        });
        if (!res.ok) {
            console.error(`Executions fetch failed for ${source}: ${res.status}`);
            return 0;
        }
        const data = await res.json();
        const count = Array.isArray(data.data) ? data.data.length : 0;
        console.log(`Executions for ${source}: ${count}`);
        return count;
    };

    const fetchWorkflowsMetrics = async (host: string, jwt: string) => {
        // Fetch all workflows and count active ones manually to be accurate
        const res = await fetch(`${cleanHost(host)}/api/v1/workflows?limit=250`, {
            headers: { 'X-N8N-API-KEY': jwt, 'Accept': 'application/json' }
        });
        if (!res.ok) return { total: 0, active: 0 };
        const data = await res.json();
        const workflows = Array.isArray(data.data) ? data.data : [];
        return {
            total: workflows.length,
            active: workflows.filter((w: any) => w.active === true).length
        };
    };

    const [saraExecs, primaryExecs, saraWks, primaryWks] = await Promise.all([
        fetchCount(SARA_HOST!, SARA_JWT!, 'SARA'),
        fetchCount(PRIMARY_HOST!, PRIMARY_JWT!, 'PRIMARY'),
        fetchWorkflowsMetrics(SARA_HOST!, SARA_JWT!),
        fetchWorkflowsMetrics(PRIMARY_HOST!, PRIMARY_JWT!)
    ]);

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

    return NextResponse.json({
      totalExecutions: saraExecs + primaryExecs,
      activeWorkflows: saraWks.active + primaryWks.active,
      geminiTokens: geminiTokens || 425600,
      instances: {
        n8n: primaryWks.active,
        sara: saraWks.active
      }
    });

  } catch (error) {
    console.error('Metrics API error:', error);
    return NextResponse.json({ error: 'Failed' }, { status: 500 });
  }
}

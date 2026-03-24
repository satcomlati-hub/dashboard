import { NextResponse } from 'next/server';

const SARA_HOST = process.env.N8N_SARA_HOST;
const SARA_JWT = process.env.N8N_SARA_JWT;
const PRIMARY_HOST = process.env.N8N_PRIMARY_HOST;
const PRIMARY_JWT = process.env.N8N_PRIMARY_JWT;

const cleanHost = (url: string) => url.endsWith('/') ? url.slice(0, -1) : url;

async function fetchWorkflows(host: string, jwt: string, source: string) {
    if (!host) return [];
    const url = `${cleanHost(host)}/api/v1/workflows?limit=250`;
    try {
        const res = await fetch(url, {
            headers: { 
                'X-N8N-API-KEY': jwt,
                'Accept': 'application/json' 
            }
        });
        if (!res.ok) {
            console.error(`Status ${res.status} from ${source} (${url})`);
            return [];
        }
        const data = await res.json();
        return (data.data || []).map((w: any) => ({
            ...w,
            source,
            host: cleanHost(host)
        }));
    } catch (e) {
        console.error(`Error fetching from ${source}:`, e);
        return [];
    }
}

export async function GET() {
    try {
        const [saraWorkflows, primaryWorkflows] = await Promise.all([
            fetchWorkflows(SARA_HOST!, SARA_JWT!, 'SARA'),
            fetchWorkflows(PRIMARY_HOST!, PRIMARY_JWT!, 'Satcom (Primary)')
        ]);

        return NextResponse.json({
            data: [...saraWorkflows, ...primaryWorkflows]
        });
    } catch (error) {
        return NextResponse.json({ error: 'Failed to fetch workflows' }, { status: 500 });
    }
}

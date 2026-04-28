import { NextResponse } from 'next/server';
import redis from '@/lib/redis';

export async function GET(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    const { id } = await params;
    
    if (!id) {
        return NextResponse.json({ error: 'Workflow ID is required' }, { status: 400 });
    }

    try {
        const key = `logs:rag:${id}`;
        // Obtener los últimos 50 logs (LRANGE key 0 49)
        const logsRaw = await redis.lrange(key, 0, 49);
        
        const logs = logsRaw.map(log => {
            try {
                return JSON.parse(log);
            } catch {
                return { message: log, timestamp: new Date().toISOString(), level: 'info' };
            }
        });

        return NextResponse.json({ logs: logs.reverse() }); // Enviamos los más recientes abajo
    } catch (error) {
        console.error('Redis fetch error:', error);
        return NextResponse.json({ error: 'Failed' }, { status: 500 });
    }
}

// DELETE to clear logs
export async function DELETE(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    const { id } = await params;
    try {
        await redis.del(`logs:rag:${id}`);
        return NextResponse.json({ success: true });
    } catch (error) {
        return NextResponse.json({ error: 'Failed' }, { status: 500 });
    }
}

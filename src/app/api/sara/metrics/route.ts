import { NextResponse } from 'next/server';
import redis from '@/lib/redis';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    // 1. Obtener la métrica en vivo
    const liveMetricsRaw = await redis.get('sara:metrics:live');
    const liveMetrics = liveMetricsRaw ? JSON.parse(liveMetricsRaw) : null;

    // 2. Obtener el historial (últimos 120 elementos)
    const historyRaw = await redis.lrange('sara:metrics:history', 0, -1);
    const history = historyRaw.map((item: string) => JSON.parse(item));

    // Devolver respuesta estructurada
    return NextResponse.json({
      online: !!liveMetrics,
      current: liveMetrics,
      history: history.reverse(), // Revertir para orden cronológico (antiguo -> nuevo) para Recharts
    });
  } catch (error) {
    console.error('Error fetching SARA metrics:', error);
    return NextResponse.json(
      { error: 'Failed to fetch SARA metrics from Redis' },
      { status: 500 }
    );
  }
}

import { NextResponse } from 'next/server';
import { query } from '@/lib/db';

export const dynamic = 'force-dynamic';

// Precios vigentes (tier standard) por modelo Gemini — alimenta el dropdown de
// modelos del editor de agentes con su valor por millón de tokens.
export async function GET() {
  try {
    const r = await query(`
      SELECT DISTINCT ON (model)
        provider, model, input_per_1m, output_per_1m, cached_per_1m
      FROM ai_pricing
      WHERE tier = 'standard'
        AND effective_from <= CURRENT_DATE
        AND provider = 'gemini'
        AND model NOT LIKE '%embedding%'
      ORDER BY model, effective_from DESC
    `);
    return NextResponse.json(
      r.rows.map(row => ({
        provider: row.provider as string,
        model: row.model as string,
        inputPer1M: Number(row.input_per_1m),
        outputPer1M: Number(row.output_per_1m),
        cachedPer1M: Number(row.cached_per_1m),
      })),
    );
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

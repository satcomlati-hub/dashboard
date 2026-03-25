import pool from '@/lib/db';
import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const query = `
      SELECT 
        manual,
        articulo,
        source_url,
        created_at,
        created_by
      FROM mm_collections_v2
      WHERE manual IS NOT NULL
      ORDER BY manual ASC, articulo ASC;
    `;

    const result = await pool.query(query);

    // Agrupar por manual
    const grouped: Record<string, { articulos: Array<{ articulo: string; source_url: string; created_at: string; created_by: string | null }> }> = {};

    for (const row of result.rows) {
      if (!grouped[row.manual]) {
        grouped[row.manual] = { articulos: [] };
      }
      grouped[row.manual].articulos.push({
        articulo: row.articulo,
        source_url: row.source_url,
        created_at: row.created_at,
        created_by: row.created_by,
      });
    }

    const data = Object.entries(grouped).map(([manual, info]) => ({
      manual,
      total: info.articulos.length,
      articulos: info.articulos,
    }));

    return NextResponse.json({ data });
  } catch (error) {
    console.error('Error fetching RAG collections:', error);
    return NextResponse.json({ error: 'Failed to fetch RAG collections' }, { status: 500 });
  }
}

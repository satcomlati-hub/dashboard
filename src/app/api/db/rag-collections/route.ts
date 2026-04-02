import pool from '@/lib/db';
import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const query = `
      SELECT
        manual,
        articulo,
        source_url,
        created_at,
        created_by,
        is_public
      FROM mm_collections_v2
      WHERE manual IS NOT NULL
      ORDER BY manual ASC, articulo ASC;
    `;

    const result = await pool.query(query);

    // Agrupar por manual
    const grouped: Record<string, { articulos: Array<{ articulo: string; source_url: string; created_at: string; created_by: string | null; is_public: boolean }> }> = {};

    for (const row of result.rows) {
      if (!grouped[row.manual]) {
        grouped[row.manual] = { articulos: [] };
      }
      grouped[row.manual].articulos.push({
        articulo: row.articulo,
        source_url: row.source_url,
        created_at: row.created_at,
        created_by: row.created_by,
        is_public: row.is_public ?? false,
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

export async function DELETE(req: NextRequest) {
  try {
    const body = await req.json();
    const { source_url } = body;

    if (typeof source_url !== 'string' || !source_url) {
      return NextResponse.json({ error: 'source_url requerido' }, { status: 400 });
    }

    await pool.query(
      `DELETE FROM zoho_learn_vectors WHERE metadata->>'source_url' = $1`,
      [source_url]
    );
    await pool.query(
      `DELETE FROM mm_base_publica WHERE metadata->>'source_url' = $1`,
      [source_url]
    );
    await pool.query(
      `DELETE FROM mm_collections_v2 WHERE source_url = $1`,
      [source_url]
    );

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting article:', error);
    return NextResponse.json({ error: 'Failed to delete article' }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const body = await req.json();
    const { source_url, manual, is_public } = body;

    if (typeof is_public !== 'boolean') {
      return NextResponse.json({ error: 'Parámetros inválidos' }, { status: 400 });
    }

    if (typeof manual === 'string') {
      // Bulk update: todos los artículos del manual
      await pool.query(
        'UPDATE mm_collections_v2 SET is_public = $1 WHERE manual = $2',
        [is_public, manual]
      );
    } else if (typeof source_url === 'string') {
      // Update individual por artículo
      await pool.query(
        'UPDATE mm_collections_v2 SET is_public = $1 WHERE source_url = $2',
        [is_public, source_url]
      );
    } else {
      return NextResponse.json({ error: 'Parámetros inválidos' }, { status: 400 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error updating is_public:', error);
    return NextResponse.json({ error: 'Failed to update visibility' }, { status: 500 });
  }
}

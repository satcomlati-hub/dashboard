import pool from '@/lib/db';
import { auth } from '@/lib/auth';
import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET() {
  const session = await auth();
  const userEmail = session?.user?.email ?? '';
  const isAdmin = session?.user?.role === 'admin';

  try {
    // Admins tienen can_edit=true global; usuarios estándar: solo si son created_by o allowed_editors
    let result;
    if (isAdmin) {
      result = await pool.query(`
        SELECT
          manual,
          articulo,
          source_url,
          created_at,
          created_by,
          modified_at,
          modified_by,
          is_public,
          true AS can_edit
        FROM mm_collections_v2
        WHERE manual IS NOT NULL
        ORDER BY manual ASC, articulo ASC;
      `);
    } else {
      result = await pool.query(`
        SELECT
          manual,
          articulo,
          source_url,
          created_at,
          created_by,
          modified_at,
          modified_by,
          is_public,
          (
            created_by = $1
            OR $1 = ANY(COALESCE(allowed_editors, ARRAY[]::text[]))
          ) AS can_edit
        FROM mm_collections_v2
        WHERE manual IS NOT NULL
        ORDER BY manual ASC, articulo ASC;
      `, [userEmail]);
    }

    // Agrupar por manual
    const grouped: Record<string, {
      articulos: Array<{
        articulo: string; source_url: string; created_at: string;
        created_by: string | null; modified_at: string | null;
        modified_by: string | null; is_public: boolean; can_edit: boolean;
      }>
    }> = {};

    for (const row of result.rows) {
      if (!grouped[row.manual]) {
        grouped[row.manual] = { articulos: [] };
      }
      grouped[row.manual].articulos.push({
        articulo: row.articulo,
        source_url: row.source_url,
        created_at: row.created_at,
        created_by: row.created_by,
        modified_at: row.modified_at,
        modified_by: row.modified_by,
        is_public: row.is_public ?? false,
        can_edit: row.can_edit ?? false,
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
    const { source_url, manual } = body;

    if (typeof manual === 'string' && manual) {
      // Borrar manual completo: todos sus artículos en las tres tablas
      await pool.query(
        `DELETE FROM zoho_learn_vectors WHERE metadata->>'source_url' IN (SELECT source_url FROM mm_collections_v2 WHERE manual = $1)`,
        [manual]
      );
      await pool.query(
        `DELETE FROM mm_base_publica WHERE metadata->>'source_url' IN (SELECT source_url FROM mm_collections_v2 WHERE manual = $1)`,
        [manual]
      );
      await pool.query(
        `DELETE FROM mm_collections_v2 WHERE manual = $1`,
        [manual]
      );
    } else if (typeof source_url === 'string' && source_url) {
      // Borrar artículo individual
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
    } else {
      return NextResponse.json({ error: 'source_url o manual requerido' }, { status: 400 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting:', error);
    return NextResponse.json({ error: 'Failed to delete' }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const body = await req.json();
    const { source_url, manual, is_public } = body;

    if (typeof is_public !== 'boolean') {
      return NextResponse.json({ error: 'Parámetros inválidos' }, { status: 400 });
    }

    if (typeof manual === 'string' && manual) {
      // Bulk update: todos los artículos del manual
      await pool.query(
        'UPDATE mm_collections_v2 SET is_public = $1 WHERE manual = $2',
        [is_public, manual]
      );
      // Sincronizar mm_base_publica automáticamente (inserta o borra según visibilidad)
      await pool.query(
        'SELECT sync_manual_visibility($1, $2)',
        [manual, is_public]
      );
    } else if (typeof source_url === 'string' && source_url) {
      // Update individual por artículo
      await pool.query(
        'UPDATE mm_collections_v2 SET is_public = $1 WHERE source_url = $2',
        [is_public, source_url]
      );
      // Sincronizar mm_base_publica automáticamente (inserta o borra según visibilidad)
      await pool.query(
        'SELECT sync_article_visibility($1, $2)',
        [source_url, is_public]
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

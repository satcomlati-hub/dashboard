import pool from '@/lib/db';
import { auth } from '@/lib/auth';
import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Ejecuta el query preferido con allowed_editors; si la columna aún no existe
 *  (migración pendiente) cae al query de respaldo sin ella. */
async function queryCollections(userEmail: string, isAdmin: boolean) {
  const canEditExpr = isAdmin
    ? 'true'
    : `(created_by = $1 OR $1 = ANY(COALESCE(allowed_editors, ARRAY[]::text[])))`;
  const params = isAdmin ? [] : [userEmail];

  // Intento principal: con allowed_editors (requiere migración aplicada)
  try {
    return await pool.query(`
      SELECT
        manual, articulo, source_url, created_at, created_by,
        modified_at, modified_by, is_public,
        COALESCE(allowed_editors, ARRAY[]::text[]) AS allowed_editors,
        ${canEditExpr} AS can_edit
      FROM mm_collections_v2
      WHERE manual IS NOT NULL
      ORDER BY manual ASC, articulo ASC;
    `, params);
  } catch {
    // Columna allowed_editors inexistente → fallback sin ella
    const canEditFallback = isAdmin ? 'true' : '(created_by = $1)';
    return await pool.query(`
      SELECT
        manual, articulo, source_url, created_at, created_by,
        modified_at, modified_by, is_public,
        ARRAY[]::text[] AS allowed_editors,
        ${canEditFallback} AS can_edit
      FROM mm_collections_v2
      WHERE manual IS NOT NULL
      ORDER BY manual ASC, articulo ASC;
    `, params);
  }
}

// ─── GET ──────────────────────────────────────────────────────────────────────

export async function GET() {
  const session = await auth();
  const userEmail = session?.user?.email ?? '';
  const isAdmin   = session?.user?.role === 'admin';

  try {
    const result = await queryCollections(userEmail, isAdmin);

    const grouped: Record<string, {
      articulos: Array<{
        articulo: string; source_url: string; created_at: string;
        created_by: string | null; modified_at: string | null;
        modified_by: string | null; is_public: boolean;
        can_edit: boolean; allowed_editors: string[];
      }>
    }> = {};

    for (const row of result.rows) {
      if (!grouped[row.manual]) grouped[row.manual] = { articulos: [] };
      grouped[row.manual].articulos.push({
        articulo:         row.articulo,
        source_url:       row.source_url,
        created_at:       row.created_at,
        created_by:       row.created_by,
        modified_at:      row.modified_at,
        modified_by:      row.modified_by,
        is_public:        row.is_public        ?? false,
        can_edit:         row.can_edit         ?? false,
        allowed_editors:  row.allowed_editors  ?? [],
      });
    }

    const data = Object.entries(grouped).map(([manual, info]) => ({
      manual,
      total:    info.articulos.length,
      articulos: info.articulos,
    }));

    return NextResponse.json({ data });
  } catch (error) {
    console.error('Error fetching RAG collections:', error);
    return NextResponse.json({ error: 'Failed to fetch RAG collections' }, { status: 500 });
  }
}

// ─── DELETE ───────────────────────────────────────────────────────────────────

export async function DELETE(req: NextRequest) {
  try {
    const body = await req.json();
    const { source_url, manual } = body;

    if (typeof manual === 'string' && manual) {
      await pool.query(
        `DELETE FROM zoho_learn_vectors WHERE metadata->>'source_url' IN (SELECT source_url FROM mm_collections_v2 WHERE manual = $1)`,
        [manual]
      );
      await pool.query(
        `DELETE FROM mm_base_publica WHERE metadata->>'source_url' IN (SELECT source_url FROM mm_collections_v2 WHERE manual = $1)`,
        [manual]
      );
      await pool.query(`DELETE FROM mm_collections_v2 WHERE manual = $1`, [manual]);
    } else if (typeof source_url === 'string' && source_url) {
      await pool.query(`DELETE FROM zoho_learn_vectors WHERE metadata->>'source_url' = $1`, [source_url]);
      await pool.query(`DELETE FROM mm_base_publica WHERE metadata->>'source_url' = $1`, [source_url]);
      await pool.query(`DELETE FROM mm_collections_v2 WHERE source_url = $1`, [source_url]);
    } else {
      return NextResponse.json({ error: 'source_url o manual requerido' }, { status: 400 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting:', error);
    return NextResponse.json({ error: 'Failed to delete' }, { status: 500 });
  }
}

// ─── PATCH ────────────────────────────────────────────────────────────────────

export async function PATCH(req: NextRequest) {
  const session = await auth();

  try {
    const body = await req.json();

    // ── Gestión de editores permitidos (solo admin) ────────────────
    if ('editor_email' in body) {
      if (session?.user?.role !== 'admin') {
        return NextResponse.json({ error: 'Solo administradores pueden gestionar editores' }, { status: 403 });
      }

      const { source_url, editor_email, editors_action } = body as {
        source_url: string; editor_email: string; editors_action: 'add' | 'remove';
      };

      if (!source_url || !editor_email || !['add', 'remove'].includes(editors_action)) {
        return NextResponse.json({ error: 'Parámetros inválidos' }, { status: 400 });
      }

      if (editors_action === 'add') {
        await pool.query(`
          UPDATE mm_collections_v2
          SET allowed_editors = array_append(COALESCE(allowed_editors, ARRAY[]::text[]), $1)
          WHERE source_url = $2
            AND NOT ($1 = ANY(COALESCE(allowed_editors, ARRAY[]::text[])))
        `, [editor_email, source_url]);
      } else {
        await pool.query(`
          UPDATE mm_collections_v2
          SET allowed_editors = array_remove(allowed_editors, $1)
          WHERE source_url = $2
        `, [editor_email, source_url]);
      }

      return NextResponse.json({ success: true });
    }

    // ── Visibilidad (is_public) ────────────────────────────────────
    const { source_url, manual, is_public } = body;

    if (typeof is_public !== 'boolean') {
      return NextResponse.json({ error: 'Parámetros inválidos' }, { status: 400 });
    }

    if (typeof manual === 'string' && manual) {
      await pool.query('UPDATE mm_collections_v2 SET is_public = $1 WHERE manual = $2', [is_public, manual]);
      await pool.query('SELECT sync_manual_visibility($1, $2)', [manual, is_public]);
    } else if (typeof source_url === 'string' && source_url) {
      await pool.query('UPDATE mm_collections_v2 SET is_public = $1 WHERE source_url = $2', [is_public, source_url]);
      await pool.query('SELECT sync_article_visibility($1, $2)', [source_url, is_public]);
    } else {
      return NextResponse.json({ error: 'Parámetros inválidos' }, { status: 400 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error en PATCH:', error);
    return NextResponse.json({ error: 'Failed to update' }, { status: 500 });
  }
}

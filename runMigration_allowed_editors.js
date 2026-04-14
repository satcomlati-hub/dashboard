/**
 * Migración: agregar columna allowed_editors a mm_collections_v2
 *
 * Ejecutar UNA SOLA VEZ:
 *   node runMigration_allowed_editors.js
 */

const { Pool } = require('pg');

const pool = new Pool({
  connectionString: 'postgresql://postgres.wpzfbpvtxrfyejoqjecu:Uzxopnm3PHqm1o5H@aws-0-us-west-2.pooler.supabase.com:6543/postgres'
});

async function run() {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // 1. Columna allowed_editors (arreglo de emails con permiso de edición)
    await client.query(`
      ALTER TABLE public.mm_collections_v2
      ADD COLUMN IF NOT EXISTS allowed_editors TEXT[] DEFAULT ARRAY[]::TEXT[];
    `);
    console.log('✓ Columna allowed_editors agregada (o ya existía).');

    // 2. Índice GIN para búsquedas eficientes dentro del arreglo
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_mm_collections_allowed_editors
        ON public.mm_collections_v2 USING GIN (allowed_editors);
    `);
    console.log('✓ Índice GIN creado en allowed_editors.');

    await client.query('COMMIT');
    console.log('\n✅ Migración completada exitosamente.');
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('❌ Error durante la migración:', err.message);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

run();

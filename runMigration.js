const { Pool } = require('pg');

const pool = new Pool({
  connectionString: 'postgresql://postgres.wpzfbpvtxrfyejoqjecu:Uzxopnm3PHqm1o5H@aws-0-us-west-2.pooler.supabase.com:6543/postgres'
});

async function run() {
  try {
    console.log("Adding columns to mm_collections_v2...");
    await pool.query(`
      ALTER TABLE public.mm_collections_v2 
      ADD COLUMN IF NOT EXISTS modified_at TIMESTAMPTZ,
      ADD COLUMN IF NOT EXISTS modified_by TEXT;
    `);
    console.log("Migration successful.");
  } catch (err) {
    console.error("Migration failed:", err);
  } finally {
    await pool.end();
  }
}

run();

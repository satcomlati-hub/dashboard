const { Client } = require('pg');

const client = new Client({
  connectionString: 'postgresql://postgres:SATCOMia2025!!@db.wpzfbpvtxrfyejoqjecu.supabase.co:5432/postgres'
});

async function run() {
  await client.connect();
  
  const res = await client.query(`
    SELECT pg_get_functiondef(p.oid) as def
    FROM pg_proc p
    JOIN pg_namespace n ON p.pronamespace = n.oid
    WHERE n.nspname = 'public' AND p.proname = 'match_zoho_learn_vectors_v4';
  `);
  
  if (res.rows.length > 0) {
    console.log(res.rows[0].def);
  } else {
    console.log('Function not found.');
  }
  
  await client.end();
}

run().catch(console.error);

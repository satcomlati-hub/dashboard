const fetch = require('node-fetch');
require('dotenv').config({ path: './.env.local' });

const SARA_HOST = process.env.N8N_SARA_HOST;
const SARA_JWT = process.env.N8N_SARA_JWT;
const PRIMARY_HOST = process.env.N8N_PRIMARY_HOST;
const PRIMARY_JWT = process.env.N8N_PRIMARY_JWT;

const cleanHost = (url) => url ? (url.endsWith('/') ? url.slice(0, -1) : url) : '';

async function test() {
    console.log('Testing SARA...');
    const saraUrl = `${cleanHost(SARA_HOST)}/api/v1/workflows?limit=5`;
    const saraRes = await fetch(saraUrl, {
        headers: { 'Authorization': `Bearer ${SARA_JWT}`, 'Accept': 'application/json' }
    });
    console.log('SARA Status:', saraRes.status);
    const saraData = await saraRes.json();
    console.log('SARA Count:', saraData.data?.length || 0);

    console.log('\nTesting PRIMARY...');
    const primUrl = `${cleanHost(PRIMARY_HOST)}/api/v1/workflows?limit=5`;
    const primRes = await fetch(primUrl, {
        headers: { 'Authorization': `Bearer ${PRIMARY_JWT}`, 'Accept': 'application/json' }
    });
    console.log('PRIMARY Status:', primRes.status);
    const primData = await primRes.json();
    console.log('PRIMARY Count:', primData.data?.length || 0);
}

test();

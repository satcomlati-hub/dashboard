const SARA_HOST = 'https://sara.mysatcomla.com';
const SARA_JWT = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiI1N2M3NjViMS0xNDQ3LTQzYTEtYTE0ZC1iYmVhY2FjNWQzMDMiLCJpc3MiOiJuOG4iLCJhdWQiOiJwdWJsaWMtYXBpIiwianRpIjoiOWEwYWJlMzQtNTRmNS00NjU2LThhZmYtZWE1NDU2OWJiYWMyIiwiaWF0IjoxNzc0MzAwNzg3fQ.wE8qgzW8dc83qN-lE2uNz1Enkh65EotW3B7XrT7Tl5o';
const PRIMARY_HOST = 'https://satcomla.app.n8n.cloud/';
const PRIMARY_JWT = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIwNzA5ZTQxMy1hYWNmLTRkNGUtYjZiMS02ODg5Yzk4ZTZmMDUiLCJpc3MiOiJuOG4iLCJhdWQiOiJwdWJsaWMtYXBpIiwianRpIjoiZWE1NTZkMDAtMzM4Ny00YTk0LWI0MjItM2ExMWI1MmZiOTFiIiwiaWF0IjoxNzc0MzAyMTk4LCJleHAiOjE3NzY4MzQwMDB9.2AkXbBli3y6fi7pOSnPfBVhNQ7P86uU1No7WSiRG5-E';

const cleanHost = (url) => url ? (url.endsWith('/') ? url.slice(0, -1) : url) : '';

async function fetchCount(host, jwt, source) {
    console.log(`Fetching from ${source}: ${cleanHost(host)}/api/v1/executions?limit=250`);
    const res = await fetch(`${cleanHost(host)}/api/v1/executions?limit=250`, {
        headers: { 'X-N8N-API-KEY': jwt, 'Accept': 'application/json' }
    });
    if (!res.ok) {
        console.error(`Failed ${source}: ${res.status}`);
        return 0;
    }
    const data = await res.json();
    const count = Array.isArray(data.data) ? data.data.length : 0;
    console.log(`${source} Executions: ${count}`);
    return count;
}

async function run() {
    const sara = await fetchCount(SARA_HOST, SARA_JWT, 'SARA');
    const primary = await fetchCount(PRIMARY_HOST, PRIMARY_JWT, 'PRIMARY');
    console.log("Total:", sara + primary);
}

run();

// Hardcoded test
const PRIMARY_HOST = "https://satcomla.app.n8n.cloud/";
const PRIMARY_JWT = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIwNzA5ZTQxMy1hYWNmLTRkNGUtYjZiMS02ODg5Yzk4ZTZmMDUiLCJpc3MiOiJuOG4iLCJhdWQiOiJwdWJsaWMtYXBpIiwianRpIjoiZWE1NTZkMDAtMzM4Ny00YTk0LWI0MjItM2ExMWI1MmZiOTFiIiwiaWF0IjoxNzc0MzAyMTk4LCJleHAiOjE3NzY4MzQwMDB9.2AkXbBli3y6fi7pOSnPfBVhNQ7P86uU1No7WSiRG5-E";

async function test() {
    const url = "https://satcomla.app.n8n.cloud/api/v1/workflows?limit=5";
    console.log('Fetching:', url);
    const res = await fetch(url, {
        headers: { 'Authorization': `Bearer ${PRIMARY_JWT}`, 'Accept': 'application/json' }
    });
    console.log('Status:', res.status);
    const data = await res.json();
    console.log('Count:', data.data?.length || 0);
    if (data.data) console.log('Sample:', data.data[0]?.name);
}

test();

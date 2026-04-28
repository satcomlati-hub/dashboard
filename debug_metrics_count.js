const SARA_HOST = 'https://sara.mysatcomla.com';
const SARA_JWT = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiI1N2M3NjViMS0xNDQ3LTQzYTEtYTE0ZC1iYmVhY2FjNWQzMDMiLCJpc3MiOiJuOG4iLCJhdWQiOiJwdWJsaWMtYXBpIiwianRpIjoiOWEwYWJlMzQtNTRmNS00NjU2LThhZmYtZWE1NDU2OWJiYWMyIiwiaWF0IjoxNzc0MzAwNzg3fQ.wE8qgzW8dc83qN-lE2uNz1Enkh65EotW3B7XrT7Tl5o';

async function test() {
    console.log("Testing with ?includeCount=true...");
    const res = await fetch(`${SARA_HOST}/api/v1/workflows?limit=1&includeCount=true`, {
        headers: { 'X-N8N-API-KEY': SARA_JWT, 'Accept': 'application/json' }
    });
    const data = await res.json();
    console.log("Keys with includeCount:", Object.keys(data));
    if (data.count !== undefined) console.log("Count found:", data.count);

    console.log("Testing with ?limit=1000 for total...");
    const res2 = await fetch(`${SARA_HOST}/api/v1/workflows?limit=1000&active=true`, {
        headers: { 'X-N8N-API-KEY': SARA_JWT, 'Accept': 'application/json' }
    });
    const data2 = await res2.json();
    console.log("Active workflows length:", data2.data?.length);
}

test();

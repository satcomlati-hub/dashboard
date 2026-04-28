const SARA_HOST = 'https://sara.mysatcomla.com';
const SARA_JWT = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiI1N2M3NjViMS0xNDQ3LTQzYTEtYTE0ZC1iYmVhY2FjNWQzMDMiLCJpc3MiOiJuOG4iLCJhdWQiOiJwdWJsaWMtYXBpIiwianRpIjoiOWEwYWJlMzQtNTRmNS00NjU2LThhZmYtZWE1NDU2OWJiYWMyIiwiaWF0IjoxNzc0MzAwNzg3fQ.wE8qgzW8dc83qN-lE2uNz1Enkh65EotW3B7XrT7Tl5o';

async function test() {
    console.log("Testing executions?limit=0...");
    const res = await fetch(`${SARA_HOST}/api/v1/executions?limit=0`, {
        headers: { 'X-N8N-API-KEY': SARA_JWT, 'Accept': 'application/json' }
    });
    const data = await res.json();
    console.log("Keys with limit=0:", Object.keys(data));
    console.log("Full response sample:", JSON.stringify(data));
}

test();

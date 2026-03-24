const SARA_HOST = 'https://sara.mysatcomla.com';
const SARA_JWT = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiI1N2M3NjViMS0xNDQ3LTQzYTEtYTE0ZC1iYmVhY2FjNWQzMDMiLCJpc3MiOiJuOG4iLCJhdWQiOiJwdWJsaWMtYXBpIiwianRpIjoiOWEwYWJlMzQtNTRmNS00NjU2LThhZmYtZWE1NDU2OWJiYWMyIiwiaWF0IjoxNzc0MzAwNzg3fQ.wE8qgzW8dc83qN-lE2uNz1Enkh65EotW3B7XrT7Tl5o';

async function test() {
    console.log("Checking headers...");
    const res = await fetch(`${SARA_HOST}/api/v1/workflows?limit=1`, {
        headers: { 'X-N8N-API-KEY': SARA_JWT, 'Accept': 'application/json' }
    });
    console.log("Headers:");
    for (let [key, value] of res.headers.entries()) {
        console.log(`${key}: ${value}`);
    }
}

test();

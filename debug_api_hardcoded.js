// Hardcoded test
const SARA_HOST = "https://sara.mysatcomla.com/";
const SARA_JWT = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiI1N2M3NjViMS0xNDQ3LTQzYTEtYTE0ZC1iYmVhY2FjNWQzMDMiLCJpc3MiOiJuOG4iLCJhdWQiOiJwdWJsaWMtYXBpIiwianRpIjoiOWEwYWJlMzQtNTRmNS00NjU2LThhZmYtZWE1NDU2OWJiYWMyIiwiaWF0IjoxNzc0MzAwNzg3fQ.wE8qgzW8dc83qN-lE2uNz1Enkh65EotW3B7XrT7Tl5o";

async function test() {
    const url = "https://sara.mysatcomla.com/api/v1/workflows?limit=5";
    console.log('Fetching:', url);
    const res = await fetch(url, {
        headers: { 'Authorization': `Bearer ${SARA_JWT}`, 'Accept': 'application/json' }
    });
    console.log('Status:', res.status);
    const data = await res.json();
    console.log('Count:', data.data?.length || 0);
    if (data.data) console.log('Sample:', data.data[0]?.name);
}

test();

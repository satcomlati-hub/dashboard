const https = require('https');

https.get('https://sara.mysatcomla.com/webhook/MonitorRabbit', (res) => {
  let data = '';
  res.on('data', (chunk) => {
    data += chunk;
  });
  res.on('end', () => {
    console.log('--- FULL DATA ---');
    console.log(data);
    console.log('--- END DATA ---');
    try {
      const parsed = JSON.parse(data);
      console.log('Parsed type:', Array.isArray(parsed) ? 'Array' : typeof parsed);
      if (Array.isArray(parsed)) {
        console.log('Array length:', parsed.length);
      } else {
        console.log('Keys:', Object.keys(parsed));
      }
    } catch (e) {
      console.log('Error parsing JSON:', e.message);
      // Check if it's multiple JSON objects concatenated
      const parts = data.split('}{');
      if (parts.length > 1) {
        console.log('Multiple objects detected:', parts.length);
      }
    }
  });
}).on('error', (err) => {
  console.log('Error:', err.message);
});

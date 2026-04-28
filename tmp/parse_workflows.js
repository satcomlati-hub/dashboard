const fs = require('fs');
const path = require('path');

const dir = 'c:\\Users\\jesus\\.gemini\\antigravity\\Interfaz\\Produccion_Satcom';
const files = fs.readdirSync(dir).filter(f => f.endsWith('.json'));

const results = files.map(file => {
  const content = JSON.parse(fs.readFileSync(path.join(dir, file), 'utf8'));
  return {
    filename: file,
    id: content.id,
    name: content.name
  };
});

console.log(JSON.stringify(results, null, 2));

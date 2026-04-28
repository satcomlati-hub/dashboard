const fs = require('fs');
const path = require('path');
const dir = 'c:\\Users\\jesus\\.gemini\\antigravity\\Interfaz\\Produccion_Satcom';
const files = fs.readdirSync(dir).filter(f => f.endsWith('.json'));

files.forEach(file => {
  const wf = JSON.parse(fs.readFileSync(path.join(dir, file), 'utf8'));
  console.log(`WF: ${wf.name} (ID: ${wf.id})`);
  wf.nodes.forEach(node => {
    if (node.type.includes('executeWorkflow') || node.type.includes('toolWorkflow')) {
      let target = node.parameters?.workflowId;
      console.log(`  Node: ${node.name} -> Target: ${JSON.stringify(target)}`);
    }
  });
});

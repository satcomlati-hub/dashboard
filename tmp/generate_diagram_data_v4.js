const fs = require('fs');
const path = require('path');

const dir = 'c:\\Users\\jesus\\.gemini\\antigravity\\Interfaz\\Produccion_Satcom';
const files = fs.readdirSync(dir).filter(f => f.endsWith('.json'));

const workflows = files.map(file => {
  return JSON.parse(fs.readFileSync(path.join(dir, file), 'utf8'));
});

// Sort workflows: MAIN first
workflows.sort((a, b) => {
  if (a.name.includes('MAIN')) return -1;
  if (b.name.includes('MAIN')) return 1;
  return a.name.localeCompare(b.name);
});

// Map workflow ID to its trigger/start node
const wfEntryPoints = {};
workflows.forEach(wf => {
  let trigger = wf.nodes.find(n => n.type.includes('Trigger') || n.name.toLowerCase().includes('start'));
  if (!trigger) trigger = wf.nodes[0];
  if (trigger) {
    wfEntryPoints[wf.id] = `${wf.id}_${trigger.id}`;
  }
});

const nodes = [];
const edges = [];

// Layout spacing
const HORIZONTAL_GAP = 800;
const VERTICAL_GAP = 1200;
const COLS = 2; // Simpler grid for better organization

let currentX = 0;
let currentY = 0;
let rowMaxHeight = 0;

workflows.forEach((wf, index) => {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  wf.nodes.forEach(n => {
    const [x, y] = n.position;
    if (x < minX) minX = x;
    if (y < minY) minY = y;
    if (x > maxX) maxX = x;
    if (y > maxY) maxY = y;
  });

  // Calculate bounding box and add padding
  const wfWidth = Math.max((maxX - minX) + 500, 1500);
  const wfHeight = Math.max((maxY - minY) + 500, 1000);

  nodes.push({
    id: wf.id,
    data: { label: wf.name },
    position: { x: currentX, y: currentY },
    style: { 
      width: wfWidth, 
      height: wfHeight, 
      backgroundColor: wf.name.includes('MAIN') ? 'rgba(113, 191, 68, 0.05)' : 'rgba(255, 255, 255, 0.4)',
      border: wf.name.includes('MAIN') ? '6px solid #71BF44' : '4px solid rgba(0,0,0,0.05)',
      borderRadius: '40px',
      fontSize: '48px',
      fontWeight: '1000',
      color: wf.name.includes('MAIN') ? '#71BF44' : '#999',
      padding: '80px',
      boxShadow: '0 20px 50px rgba(0,0,0,0.05)',
      backdropFilter: 'blur(10px)'
    },
    type: 'group'
  });

  wf.nodes.forEach(node => {
    nodes.push({
      id: `${wf.id}_${node.id}`,
      parentId: wf.id,
      data: { 
        label: node.name,
        n8nType: node.type,
        id: node.id
      },
      position: { 
        x: (node.position[0] - minX) + 200, 
        y: (node.position[1] - minY) + 300 
      },
      type: 'customNode',
      extent: 'parent'
    });

    // Sub-workflow detection logic
    let targetWfId = null;
    if (node.parameters) {
       // Check standard executeWorkflow
       if (node.parameters.workflowId) {
          targetWfId = typeof node.parameters.workflowId === 'object' ? node.parameters.workflowId.value : node.parameters.workflowId;
       }
       // Check toolWorkflow or AI triggers
       if (!targetWfId && node.parameters.resource === 'workflow' && node.parameters.workflow) {
          targetWfId = node.parameters.workflow;
       }
    }

    if (targetWfId && wfEntryPoints[targetWfId]) {
      edges.push({
        id: `link_${node.id}_to_${targetWfId}`,
        source: `${wf.id}_${node.id}`,
        target: wfEntryPoints[targetWfId],
        animated: true,
        style: { stroke: '#71BF44', strokeWidth: 8, strokeDasharray: '10, 5' },
        label: '⟶ LINK A SISTEMA',
        labelStyle: { fill: '#71BF44', fontWeight: '900', fontSize: 14 },
        markerEnd: { type: 'arrow', color: '#71BF44' },
        type: 'smoothstep'
      });
    }
  });

  if (wf.connections) {
    Object.keys(wf.connections).forEach(sourceNodeName => {
      const sourceId = wf.nodes.find(n => n.name === sourceNodeName)?.id;
      if (!sourceId) return;

      const outputs = wf.connections[sourceNodeName].main;
      if (outputs) {
        outputs.forEach(outputSet => {
          outputSet.forEach(target => {
            const targetId = wf.nodes.find(n => n.name === target.node)?.id;
            if (targetId) {
              edges.push({
                id: `e_${wf.id}_${sourceId}_${targetId}`,
                source: `${wf.id}_${sourceId}`,
                target: `${wf.id}_${targetId}`,
                style: { stroke: 'rgba(0,0,0,0.2)', strokeWidth: 3 },
                markerEnd: { type: 'arrow', color: 'rgba(0,0,0,0.2)' }
              });
            }
          });
        });
      }
    });
  }

  // Layout positioning
  rowMaxHeight = Math.max(rowMaxHeight, wfHeight);
  if ((index + 1) % COLS === 0) {
    currentX = 0;
    currentY += rowMaxHeight + VERTICAL_GAP;
    rowMaxHeight = 0;
  } else {
    currentX += wfWidth + HORIZONTAL_GAP;
  }
});

const output = { nodes, edges };
fs.writeFileSync('c:\\Users\\jesus\\.gemini\\antigravity\\Interfaz\\dashboard\\src\\data\\satcom-diagram.json', JSON.stringify(output, null, 2));
console.log('Diagram logic highly optimized (v4).');

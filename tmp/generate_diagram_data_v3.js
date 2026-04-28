const fs = require('fs');
const path = require('path');

const dir = 'c:\\Users\\jesus\\.gemini\\antigravity\\Interfaz\\Produccion_Satcom';
const files = fs.readdirSync(dir).filter(f => f.endsWith('.json'));

const workflows = files.map(file => {
  return JSON.parse(fs.readFileSync(path.join(dir, file), 'utf8'));
});

// Map workflow ID to its trigger/start node
const wfEntryPoints = {};
workflows.forEach(wf => {
  // Try to find an executeWorkflowTrigger or any Trigger
  let trigger = wf.nodes.find(n => n.type.includes('Trigger'));
  if (!trigger) trigger = wf.nodes[0]; // fallback
  if (trigger) {
    wfEntryPoints[wf.id] = `${wf.id}_${trigger.id}`;
  }
});

const nodes = [];
const edges = [];

// Layout: 3 columns, auto-height
const G_SPACING = 600;
const COLS = 3;
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

  const wfWidth = Math.max((maxX - minX) + 400, 1200);
  const wfHeight = Math.max((maxY - minY) + 400, 800);

  nodes.push({
    id: wf.id,
    data: { label: wf.name },
    position: { x: currentX, y: currentY },
    style: { 
      width: wfWidth, 
      height: wfHeight, 
      backgroundColor: wf.name.includes('MAIN') ? 'rgba(113, 191, 68, 0.08)' : 'rgba(0, 0, 0, 0.02)',
      border: wf.name.includes('MAIN') ? '5px solid #71BF44' : '3px dashed rgba(0,0,0,0.1)',
      borderRadius: '32px',
      fontSize: '42px',
      fontWeight: '900',
      color: wf.name.includes('MAIN') ? '#71BF44' : 'rgba(0,0,0,0.2)',
      padding: '60px'
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
        x: (node.position[0] - minX) + 150, 
        y: (node.position[1] - minY) + 200 
      },
      type: 'customNode',
      extent: 'parent'
    });

    // Extract target workflow ID for sub-workflow nodes
    let targetWfId = null;
    if (node.parameters && node.parameters.workflowId) {
       targetWfId = typeof node.parameters.workflowId === 'object' ? node.parameters.workflowId.value : node.parameters.workflowId;
    }

    if (targetWfId && wfEntryPoints[targetWfId]) {
      edges.push({
        id: `link_${node.id}_to_${targetWfId}`,
        source: `${wf.id}_${node.id}`,
        target: wfEntryPoints[targetWfId], // Link directly to the entry node
        animated: true,
        style: { stroke: '#71BF44', strokeWidth: 5 },
        label: 'Calls Subflow',
        labelStyle: { fill: '#71BF44', fontWeight: 'bold' },
        markerEnd: { type: 'arrow' }
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
                style: { stroke: '#888', strokeWidth: 2 },
                markerEnd: { type: 'arrow', color: '#888' }
              });
            }
          });
        });
      }
    });
  }

  // Row/Col layout logic
  rowMaxHeight = Math.max(rowMaxHeight, wfHeight);
  if ((index + 1) % COLS === 0) {
    currentX = 0;
    currentY += rowMaxHeight + G_SPACING;
    rowMaxHeight = 0;
  } else {
    currentX += wfWidth + G_SPACING;
  }
});

const output = { nodes, edges };
fs.writeFileSync('c:\\Users\\jesus\\.gemini\\antigravity\\Interfaz\\dashboard\\src\\data\\satcom-diagram.json', JSON.stringify(output, null, 2));
console.log('Diagram data logic optimized.');

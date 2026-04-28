const fs = require('fs');
const path = require('path');

const dir = 'c:\\Users\\jesus\\.gemini\\antigravity\\Interfaz\\Produccion_Satcom';
const files = fs.readdirSync(dir).filter(f => f.endsWith('.json'));

const workflows = files.map(file => {
  return JSON.parse(fs.readFileSync(path.join(dir, file), 'utf8'));
});

const nodes = [];
const edges = [];

// Layout constants
const G_SPACING = 500; // Spacing between groups
let currentX = 0;
let currentY = 0;
const COLS = 3;

workflows.forEach((wf, index) => {
  // 1. Find bounding box of nodes in this workflow
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  wf.nodes.forEach(n => {
    const [x, y] = n.position;
    if (x < minX) minX = x;
    if (y < minY) minY = y;
    if (x > maxX) maxX = x;
    if (y > maxY) maxY = y;
  });

  const wfWidth = (maxX - minX) + 400; // padding
  const wfHeight = (maxY - minY) + 400; // padding

  // 2. Position the group
  const groupX = currentX;
  const groupY = currentY;

  nodes.push({
    id: wf.id,
    data: { label: wf.name },
    position: { x: groupX, y: groupY },
    style: { 
      width: wfWidth, 
      height: wfHeight, 
      backgroundColor: 'rgba(113, 191, 68, 0.05)',
      border: '4px solid rgba(113, 191, 68, 0.4)',
      borderRadius: '24px',
      fontSize: '48px',
      fontWeight: 'bold',
      color: 'rgba(113, 191, 68, 0.8)',
      padding: '80px'
    },
    type: 'group'
  });

  // 3. Add normalized nodes
  wf.nodes.forEach(node => {
    nodes.push({
      id: `${wf.id}_${node.id}`,
      parentId: wf.id,
      data: { 
        label: node.name,
        n8nType: node.type,
        id: node.id
      },
      // Transform coordinates to be relative to the group (0,0) with normalization
      position: { 
        x: (node.position[0] - minX) + 100, 
        y: (node.position[1] - minY) + 150 
      },
      type: 'customNode',
      extent: 'parent'
    });

    // Sub-workflow connections
    let targetWfId = null;
    if (node.parameters && node.parameters.workflowId) {
       targetWfId = node.parameters.workflowId.value;
    }

    if (targetWfId) {
      edges.push({
        id: `link_${node.id}_to_${targetWfId}`,
        source: `${wf.id}_${node.id}`,
        target: targetWfId,
        animated: true,
        style: { stroke: '#71BF44', strokeWidth: 4, strokeDasharray: '5,5' },
        label: 'Abre Subflujo',
        labelStyle: { fill: '#71BF44', fontWeight: 'bold', fontSize: 10 }
      });
    }
  });

  // 4. Map internal connections
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
                style: { stroke: '#444', strokeWidth: 3 },
                animated: false,
                markerEnd: { type: 'arrow' }
              });
            }
          });
        });
      }
    });
  }

  // Update layout positions for next group
  if ((index + 1) % COLS === 0) {
    currentX = 0;
    currentY += Math.max(wfHeight, 1000) + G_SPACING;
  } else {
    currentX += Math.max(wfWidth, 1500) + G_SPACING;
  }
});

const output = { nodes, edges };
fs.writeFileSync('c:\\Users\\jesus\\.gemini\\antigravity\\Interfaz\\dashboard\\src\\data\\satcom-diagram.json', JSON.stringify(output, null, 2));
console.log('Diagram data normalized successfully.');

const fs = require('fs');
const path = require('path');

const dir = 'c:\\Users\\jesus\\.gemini\\antigravity\\Interfaz\\Produccion_Satcom';
const files = fs.readdirSync(dir).filter(f => f.endsWith('.json'));

const workflows = files.map(file => {
  return JSON.parse(fs.readFileSync(path.join(dir, file), 'utf8'));
});

const nodes = [];
const edges = [];

// Workflow spacing
const WF_WIDTH = 2000;
const WF_HEIGHT = 1500;
const COLS = 4;

workflows.forEach((wf, index) => {
  const offsetX = (index % COLS) * WF_WIDTH;
  const offsetY = Math.floor(index / COLS) * WF_HEIGHT;

  // Add a parent group node for each workflow
  nodes.push({
    id: wf.id,
    data: { label: wf.name },
    position: { x: offsetX, y: offsetY },
    style: { 
      width: WF_WIDTH - 100, 
      height: WF_HEIGHT - 100, 
      backgroundColor: 'rgba(113, 191, 68, 0.05)',
      border: '2px dashed rgba(113, 191, 68, 0.3)',
      borderRadius: '20px',
      fontSize: '24px',
      fontWeight: 'bold',
      color: 'rgba(113, 191, 68, 0.5)',
      padding: '20px'
    },
    type: 'group'
  });

  // Map nodes in this workflow
  wf.nodes.forEach(node => {
    // Determine type for styling
    let nodeType = 'default';
    if (node.type.includes('Trigger')) nodeType = 'input';
    if (node.type.includes('Output')) nodeType = 'output';

    nodes.push({
      id: `${wf.id}_${node.id}`,
      parentId: wf.id,
      data: { 
        label: node.name,
        n8nType: node.type,
        id: node.id
      },
      position: { x: node.position[0] + (WF_WIDTH / 2), y: node.position[1] + (WF_HEIGHT / 2) },
      type: 'customNode', // We will define this in React
      extent: 'parent'
    });

    // Check if it's a call to another workflow
    let targetWfId = null;
    if (node.parameters && node.parameters.workflowId) {
       targetWfId = node.parameters.workflowId.value;
    }

    if (targetWfId) {
      // Connect this node to the entry point of the target workflow
      edges.push({
        id: `link_${node.id}_to_${targetWfId}`,
        source: `${wf.id}_${node.id}`,
        target: targetWfId,
        animated: true,
        style: { stroke: '#71BF44', strokeWidth: 3 },
        label: 'Calls Sub-Workflow'
      });
    }
  });

  // Map internal connections
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
                style: { stroke: '#444' }
              });
            }
          });
        });
      }
    });
  }
});

const output = { nodes, edges };
fs.writeFileSync('c:\\Users\\jesus\\.gemini\\antigravity\\Interfaz\\dashboard\\src\\data\\satcom-diagram.json', JSON.stringify(output, null, 2));
console.log('Diagram data generated successfully.');

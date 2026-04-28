const fs = require('fs');
const path = require('path');

const dir = 'c:\\Users\\jesus\\.gemini\\antigravity\\Interfaz\\Produccion_Satcom';
const files = fs.readdirSync(dir).filter(f => f.endsWith('.json'));

const workflows = files.map(file => {
  return JSON.parse(fs.readFileSync(path.join(dir, file), 'utf8'));
});

// Map workflow ID to its full object
const wfMap = {};
workflows.forEach(wf => wfMap[wf.id] = wf);

// Map workflow ID to its trigger node
const wfEntryPoints = {};
workflows.forEach(wf => {
  let trigger = wf.nodes.find(n => n.type.includes('Trigger') || n.name.toLowerCase().includes('start'));
  if (!trigger) trigger = wf.nodes[0];
  if (trigger) wfEntryPoints[wf.id] = `${wf.id}_${trigger.id}`;
});

// Calculate dependencies and levels
const levels = {}; // wfId -> level
const deps = {}; // wfId -> [childWfIds]

workflows.forEach(wf => {
  deps[wf.id] = [];
  wf.nodes.forEach(node => {
    let targetWfId = null;
    if (node.parameters) {
       if (node.parameters.workflowId) {
          targetWfId = typeof node.parameters.workflowId === 'object' ? node.parameters.workflowId.value : node.parameters.workflowId;
       }
       if (!targetWfId && node.parameters.resource === 'workflow' && node.parameters.workflow) {
          targetWfId = node.parameters.workflow;
       }
    }
    if (targetWfId && wfMap[targetWfId] && !deps[wf.id].includes(targetWfId)) {
      deps[wf.id].push(targetWfId);
    }
  });
});

// Find MAIN and start BFS for levels
const mainWf = workflows.find(wf => wf.name.includes('MAIN'));
const queue = [{ id: mainWf.id, level: 0 }];
levels[mainWf.id] = 0;

while (queue.length > 0) {
  const { id, level } = queue.shift();
  (deps[id] || []).forEach(childId => {
    if (levels[childId] === undefined) {
      levels[childId] = level + 1;
      queue.push({ id: childId, level: level + 1 });
    }
  });
}

// Assign level 1 to orphan workflows (those not reachable from MAIN)
workflows.forEach(wf => {
  if (levels[wf.id] === undefined) levels[wf.id] = 1;
});

// Build columns
const levelsArray = [];
Object.entries(levels).forEach(([id, level]) => {
  if (!levelsArray[level]) levelsArray[level] = [];
  levelsArray[level].push(id);
});

const nodes = [];
const edges = [];

// Layout constants
const LEVEL_Y_GAP = 2500;
const COLUMN_X_GAP = 1500;

levelsArray.forEach((levelWfIds, levelIndex) => {
  const levelY = levelIndex * LEVEL_Y_GAP;
  const levelWidth = levelWfIds.length * 2000;
  let startX = -(levelWidth / 2);

  levelWfIds.forEach((wfId, wfIndex) => {
    const wf = wfMap[wfId];
    if (!wf) return;

    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    wf.nodes.forEach(n => {
      const [x, y] = n.position;
      if (x < minX) minX = x;
      if (y < minY) minY = y;
      if (x > maxX) maxX = x;
      if (y > maxY) maxY = y;
    });

    const wfWidth = Math.max((maxX - minX) + 600, 1800);
    const wfHeight = Math.max((maxY - minY) + 600, 1200);

    const currentX = startX + (wfIndex * (wfWidth + COLUMN_X_GAP));

    nodes.push({
      id: wf.id,
      data: { label: wf.name },
      position: { x: currentX, y: levelY },
      style: { 
        width: wfWidth, 
        height: wfHeight, 
        backgroundColor: levelIndex === 0 ? 'rgba(113, 191, 68, 0.08)' : 'rgba(255, 255, 255, 0.02)',
        border: levelIndex === 0 ? '8px solid #71BF44' : '4px solid rgba(0,0,0,0.1)',
        borderRadius: '40px',
        fontSize: '60px',
        fontWeight: '900',
        color: levelIndex === 0 ? '#71BF44' : '#666',
        padding: '100px',
        boxShadow: '0 30px 60px rgba(0,0,0,0.08)',
        zIndex: -1
      },
      type: 'group'
    });

    // Internal nodes
    wf.nodes.forEach(node => {
      nodes.push({
        id: `${wf.id}_${node.id}`,
        parentId: wf.id,
        data: { label: node.name, n8nType: node.type, id: node.id },
        position: { x: (node.position[0] - minX) + 300, y: (node.position[1] - minY) + 350 },
        type: 'customNode',
        extent: 'parent'
      });

      // Connections extraction
      let targetWfId = null;
      if (node.parameters) {
         if (node.parameters.workflowId) targetWfId = typeof node.parameters.workflowId === 'object' ? node.parameters.workflowId.value : node.parameters.workflowId;
         if (!targetWfId && node.parameters.resource === 'workflow' && node.parameters.workflow) targetWfId = node.parameters.workflow;
      }
      if (targetWfId && wfEntryPoints[targetWfId]) {
        edges.push({
          id: `link_${node.id}_to_${targetWfId}`,
          source: `${wf.id}_${node.id}`,
          target: wfEntryPoints[targetWfId],
          sourceHandle: 'bottom',
          targetHandle: 'top',
          animated: true,
          style: { stroke: '#71BF44', strokeWidth: 10, strokeDasharray: '15, 10' },
          label: 'LLAMADA A SUBFLUJO',
          labelStyle: { fill: '#71BF44', fontWeight: 'bold', fontSize: 16 },
          markerEnd: { type: 'arrow', color: '#71BF44', width: 20, height: 20 },
          type: 'smoothstep'
        });
      }
    });

    if (wf.connections) {
      Object.keys(wf.connections).forEach(srcName => {
        const srcNode = wf.nodes.find(n => n.name === srcName);
        if (!srcNode) return;
        const outputs = wf.connections[srcName].main;
        if (outputs) outputs.forEach(outSet => outSet.forEach(tgt => {
          const tgtNode = wf.nodes.find(n => n.name === tgt.node);
          if (tgtNode) edges.push({
            id: `e_${wf.id}_${srcNode.id}_${tgtNode.id}`,
            source: `${wf.id}_${srcNode.id}`,
            target: `${wf.id}_${tgtNode.id}`,
            style: { stroke: 'rgba(0,0,0,0.15)', strokeWidth: 4 },
            markerEnd: { type: 'arrow', color: 'rgba(0,0,0,0.15)' }
          });
        }));
      });
    }
  });
});

const output = { nodes, edges };
fs.writeFileSync('c:\\Users\\jesus\\.gemini\\antigravity\\Interfaz\\dashboard\\src\\data\\satcom-diagram.json', JSON.stringify(output, null, 2));
console.log('Hierarchical layout logic generated (v5).');

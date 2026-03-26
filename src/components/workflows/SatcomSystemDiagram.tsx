'use client';
import React, { useCallback, useMemo, useEffect } from 'react';
import {
  ReactFlow,
  MiniMap,
  Controls,
  Background,
  useNodesState,
  useEdgesState,
  addEdge,
  Panel,
  useReactFlow,
  ReactFlowProvider,
  Handle, 
  Position
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { Bot, Cpu, Database, Send, Zap, Activity, Maximize, MousePointer2, ChevronRight, Info } from 'lucide-react';

const nodeTypes = {
  customNode: CustomNode,
};

function CustomNode({ data, selected }: any) {
  const isCerebro = data.label === 'CerebroSatcom' || (data.n8nType && data.n8nType.includes('langchain.agent'));
  const isInput = data.label === 'Input';
  const isSubflow = data.n8nType && (data.n8nType.includes('executeWorkflow') || data.n8nType.includes('toolWorkflow'));
  const isTool = data.n8nType && (data.n8nType.includes('toolWorkflow') || data.n8nType.includes('executeWorkflow'));
  const isTrigger = data.n8nType && (data.n8nType.includes('Trigger') || data.n8nType.includes('Webhook'));

  return (
    <div className={`
      px-5 py-4 shadow-2xl rounded-2xl bg-white dark:bg-[#1a1a1a] border-[3px] 
      ${isCerebro ? 'border-[#71BF44] ring-4 ring-[#71BF44]/10' : 
        isTrigger ? 'border-orange-500 bg-orange-50/5' :
        isSubflow ? 'border-purple-500 bg-purple-50/10' :
        isTool ? 'border-blue-500 bg-blue-50/10' : 'border-neutral-200 dark:border-neutral-800'}
      min-w-[280px] transition-all group relative
    `}>
      <Handle id="left-target" type="target" position={Position.Left} className="w-3 h-3 !bg-[#71BF44] border-2 border-white -translate-x-1.5" />
      <Handle id="right-source" type="source" position={Position.Right} className="w-3 h-3 !bg-[#71BF44] border-2 border-white translate-x-1.5" />
      <Handle id="top-target" type="target" position={Position.Top} className="w-3 h-3 !bg-[#71BF44] border-2 border-white -translate-y-1.5" />
      <Handle id="bottom-source" type="source" position={Position.Bottom} className="w-3 h-3 !bg-[#71BF44] border-2 border-white translate-y-1.5" />
      
      <div className="flex items-center gap-4">
        <div className={`p-3 rounded-xl ${(isCerebro || isInput) ? 'bg-[#71BF44] text-white shadow-lg' : isTrigger ? 'bg-orange-500 text-white' : isSubflow ? 'bg-purple-500 text-white' : 'bg-neutral-100 dark:bg-neutral-800 text-neutral-500'}`}>
           {getNodeIcon(data.n8nType || '')}
        </div>
        <div className="flex-1 overflow-hidden">
          <div className="text-[10px] font-bold text-neutral-400 uppercase tracking-widest truncate">
            {data.n8nType ? data.n8nType.split('.').pop() : 'NODE'}
          </div>
          <div className="text-lg font-black dark:text-white truncate">{data.label}</div>
        </div>
        {(isTool) && (
          <div className="bg-primary-500 text-white p-1 rounded-full">
            <ChevronRight size={14} />
          </div>
        )}
      </div>

      <div className="mt-3 pt-2 border-t border-neutral-100 dark:border-neutral-800 flex justify-between items-center">
        <div className="text-[9px] font-mono text-neutral-400">ID: {data.id?.slice(0, 8)}</div>
        {isCerebro && <div className="text-[9px] font-black text-[#71BF44]">START</div>}
      </div>
    </div>
  );
}

function getNodeIcon(type: string) {
  if (type.includes('telegram')) return <Send size={18} />;
  if (type.includes('postgres') || type.includes('redis') || type.includes('supabase')) return <Database size={18} />;
  if (type.includes('agent') || type.includes('google') || type.includes('Code')) return <Cpu size={18} />;
  if (type.includes('Workflow')) return <Zap size={18} />;
  return <Bot size={18} />;
}

// Parser for n8n format to React Flow format
export function parseN8nWorkflow(n8nData: any) {
  if (!n8nData || !n8nData.nodes) return { nodes: [], edges: [] };

  const nodes = n8nData.nodes.map((node: any) => {
    const isVertical = node.name === 'CerebroSatcom' || 
                       node.name === 'Input' || 
                       node.type.includes('toolWorkflow') || 
                       node.type.includes('executeWorkflow');

    return {
      id: node.id,
      type: 'customNode',
      position: { x: node.position[0] * 3.5, y: node.position[1] * 1.5 },
      data: {
        label: node.name,
        n8nType: node.type,
        id: node.id,
      },
      draggable: false,
      sourcePosition: isVertical ? Position.Bottom : Position.Right,
      targetPosition: isVertical ? Position.Top : Position.Left,
    };
  });

  const edges: any[] = [];
  const nodeNameToId: Record<string, string> = {};
  n8nData.nodes.forEach((n: any) => nodeNameToId[n.name] = n.id);

  if (n8nData.connections) {
    Object.keys(n8nData.connections).forEach((sourceName) => {
      const sourceId = nodeNameToId[sourceName];
      const sourceConnections = n8nData.connections[sourceName];

      // Process all connection types (main, ai_tool, ai_languageModel, etc.)
      Object.keys(sourceConnections).forEach((connectionType) => {
        sourceConnections[connectionType].forEach((outputGroup: any[]) => {
          outputGroup.forEach((conn) => {
            const targetId = nodeNameToId[conn.node];
            const targetNode = n8nData.nodes.find((n: any) => n.id === targetId);
            const sourceNode = n8nData.nodes.find((n: any) => n.name === sourceName);

            if (sourceId && targetId && sourceNode && targetNode) {
              const isAIConnection = connectionType.startsWith('ai_');
              
              const isSourceVertical = sourceNode.name === 'CerebroSatcom' || 
                                      sourceNode.name === 'Input' || 
                                      sourceNode.type.includes('langchain.agent') ||
                                      sourceNode.type.includes('langchain.lmChatGoogleGemini') ||
                                      sourceNode.type.includes('toolWorkflow') || 
                                      sourceNode.type.includes('executeWorkflow');
              
              const isTargetVertical = targetNode.name === 'CerebroSatcom' || 
                                      targetNode.name === 'Input' || 
                                      targetNode.type.includes('langchain.agent') ||
                                      targetNode.type.includes('langchain.lmChatGoogleGemini') ||
                                      targetNode.type.includes('toolWorkflow') || 
                                      targetNode.type.includes('executeWorkflow');

              edges.push({
                id: `e-${sourceId}-${targetId}-${connectionType}`,
                source: sourceId,
                target: targetId,
                sourceHandle: isSourceVertical ? 'bottom-source' : 'right-source',
                targetHandle: isTargetVertical ? 'top-target' : 'left-target',
                animated: true,
                style: { 
                  strokeWidth: isAIConnection ? 3 : 2, 
                  stroke: isAIConnection ? '#71BF44' : '#71BF44',
                  strokeDasharray: isAIConnection ? '5 5' : 'none'
                },
                type: 'smoothstep'
              });
            }
          });
        });
      });
    });
  }

  return { nodes, edges };
}

interface SatcomSystemDiagramProps {
  data?: any; // Raw n8n data
  initialData?: { nodes: any[], edges: any[] }; // Pre-parsed data
}

function DiagramInner({ data, initialData }: SatcomSystemDiagramProps) {
  const { fitView } = useReactFlow();
  
  const parsed = useMemo(() => {
    if (initialData) return initialData;
    return parseN8nWorkflow(data);
  }, [data, initialData]);

  const [nodes, setNodes, onNodesChange] = useNodesState(parsed.nodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(parsed.edges);

  useEffect(() => {
    setNodes(parsed.nodes);
    setEdges(parsed.edges);
    // Auto fit view when data changes
    setTimeout(() => fitView({ duration: 800, padding: 0.2 }), 100);
  }, [parsed, setNodes, setEdges, fitView]);

  const onConnect = useCallback(
    (params: any) => setEdges((eds) => addEdge(params, eds)),
    [setEdges],
  );

  return (
    <div className="w-full h-[700px] bg-neutral-50 dark:bg-[#0A0A0A] rounded-2xl border border-neutral-200 dark:border-neutral-800 overflow-hidden relative shadow-2xl">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        nodeTypes={nodeTypes}
        fitView
        fitViewOptions={{ padding: 0.3 }}
        minZoom={0.05}
        maxZoom={2}
        style={{ background: 'transparent' }}
        nodesDraggable={false} // Disable dragging globally
        onlyRenderVisibleElements={true}
        defaultEdgeOptions={{ 
          animated: true, 
          style: { strokeWidth: 2 } 
        }}
      >
        <Controls showInteractive={false} />
        <MiniMap 
          nodeStrokeWidth={3}
          zoomable
          pannable
          style={{ height: 120, width: 160 }}
          nodeColor={(n: any) => n.data?.label?.includes('Input') || n.data?.label?.includes('Trigger') ? '#71BF44' : '#666'}
        />
        <Background gap={40} size={1} color="rgba(0,0,0,0.06)" className="dark:hidden" />
        <Background gap={40} size={1} color="rgba(255,255,255,0.03)" className="hidden dark:block" />
        
        <Panel position="top-left" className="m-4 flex flex-col gap-2">
            <button 
              onClick={() => fitView({ duration: 800, padding: 0.2 })}
              className="flex items-center gap-2 bg-white dark:bg-[#131313] px-4 py-2 rounded-lg border border-neutral-200 dark:border-neutral-800 shadow-lg hover:bg-neutral-50 dark:hover:bg-[#1a1a1a] transition-all text-sm font-bold dark:text-white"
            >
              <Maximize size={16} className="text-[#71BF44]" />
              Centrar Vista
            </button>
        </Panel>

        <Panel position="top-right" className="bg-white/90 dark:bg-[#131313]/90 backdrop-blur-md p-3 rounded-xl border border-neutral-200 dark:border-neutral-800 shadow-xl m-4">
           <div className="flex items-center gap-3">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-[#71BF44] animate-pulse" />
                <span className="text-[10px] font-bold text-neutral-500 uppercase tracking-tighter">Diagrama Dinámico</span>
              </div>
              <div className="h-4 w-px bg-neutral-200 dark:bg-neutral-800" />
              <div className="flex items-center gap-2">
                <Activity size={14} className="text-[#71BF44]" />
                <span className="text-[10px] font-bold text-neutral-400">
                   {nodes.length} Nodos • {edges.length} Enlaces
                </span>
              </div>
           </div>
        </Panel>

        <Panel position="bottom-left" className="m-4 flex flex-col gap-2">
           <div className="bg-white/95 dark:bg-[#1a1a1a]/95 p-3 rounded-xl border border-neutral-200 dark:border-neutral-800 text-[10px] text-neutral-400 shadow-xl flex items-center gap-4">
              <div className="flex items-center gap-2">
                 <Info size={12} className="text-[#71BF44]" />
                 <span className="font-bold">Vista de Arquitectura (Solo Lectura)</span>
              </div>
              <div className="w-1 h-1 rounded-full bg-neutral-300 dark:bg-neutral-700" />
              <div className="flex items-center gap-2">
                 <MousePointer2 size={12} />
                 <span>Arrastrar para Pan</span>
              </div>
              <div className="w-1 h-1 rounded-full bg-neutral-300 dark:bg-neutral-700" />
              <div className="flex items-center gap-2">
                 <Maximize size={12} />
                 <span>Zoom con Rueda</span>
              </div>
           </div>
        </Panel>
      </ReactFlow>
    </div>
  );
}

export default function SatcomSystemDiagram(props: SatcomSystemDiagramProps) {
  return (
    <ReactFlowProvider>
      <DiagramInner {...props} />
    </ReactFlowProvider>
  );
}

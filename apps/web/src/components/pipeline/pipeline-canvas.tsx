'use client';

import {
  useCallback,
  useRef,
  useState,
  useMemo,
  type DragEvent,
} from 'react';
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  Panel,
  addEdge,
  useNodesState,
  useEdgesState,
  type Connection,
  type NodeTypes,
  type Edge,
  type Node as RFNode,
  type OnConnect,
  BackgroundVariant,
  MarkerType,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';

import type { PipelineNodeType, PipelineNode, PipelineEdge, PipelineValidationError } from '@liftoff/shared';
import { NodePalette } from './node-palette';
import { NodeConfigPanel } from './node-config-panel';
import { YamlPreviewPanel } from './yaml-preview-panel';
import { TemplateChooser } from './template-chooser';
import type { PipelineTemplate } from './pipeline-templates';
import PipelineNodeComponent from './nodes/pipeline-node';

/* ─── Types ─── */

interface PipelineCanvasProps {
  environmentId: string;
  initialNodes: PipelineNode[];
  initialEdges: PipelineEdge[];
  compiledYaml: string | null;
  isValid: boolean;
  validationErrors: PipelineValidationError[] | null;
  onSave: (nodes: PipelineNode[], edges: PipelineEdge[]) => void;
  onCompile: () => void;
  onDeploy: () => void;
  isSaving: boolean;
  isCompiling: boolean;
  isDeploying: boolean;
}

/* ─── Edge validation rules ─── */

const TRIGGER_TYPES: PipelineNodeType[] = ['GitHubPushTrigger', 'ManualTrigger', 'ScheduleTrigger'];
const BUILD_TYPES: PipelineNodeType[] = ['DockerBuild', 'AutoDetectBuild'];
const SERVICE_TYPES: PipelineNodeType[] = ['AppService'];

function isValidConnection(sourceType: PipelineNodeType, targetType: PipelineNodeType): boolean {
  // Trigger → Build only
  if (TRIGGER_TYPES.includes(sourceType)) return BUILD_TYPES.includes(targetType);
  // Build → Service only
  if (BUILD_TYPES.includes(sourceType)) return SERVICE_TYPES.includes(targetType);
  // Infra/Config → Service only
  return SERVICE_TYPES.includes(targetType);
}

/* ─── Helpers ─── */

let idCounter = 0;
function nextId(): string {
  return `node_${Date.now()}_${++idCounter}`;
}

function toRFNodes(nodes: PipelineNode[]): RFNode[] {
  return nodes.map((n) => ({
    id: n.id,
    type: n.type,
    data: { ...n.data },
    position: n.position,
  }));
}

function toRFEdges(edges: PipelineEdge[]): Edge[] {
  return edges.map((e) => ({
    id: e.id,
    source: e.source,
    target: e.target,
    sourceHandle: e.sourceHandle,
    targetHandle: e.targetHandle,
    animated: true,
    style: { stroke: 'hsl(var(--muted-foreground))', strokeWidth: 2 },
    markerEnd: { type: MarkerType.ArrowClosed, color: 'hsl(var(--muted-foreground))' },
  }));
}

function fromRFNodes(nodes: RFNode[]): PipelineNode[] {
  return nodes.map((n) => ({
    id: n.id,
    type: n.type as PipelineNodeType,
    data: n.data as Record<string, unknown>,
    position: n.position,
  }));
}

function fromRFEdges(edges: Edge[]): PipelineEdge[] {
  return edges.map((e) => ({
    id: e.id,
    source: e.source,
    target: e.target,
    sourceHandle: e.sourceHandle ?? undefined,
    targetHandle: e.targetHandle ?? undefined,
  }));
}

/* ─── Node type registry ─── */

const nodeTypes: NodeTypes = {
  GitHubPushTrigger: PipelineNodeComponent,
  ManualTrigger: PipelineNodeComponent,
  ScheduleTrigger: PipelineNodeComponent,
  DockerBuild: PipelineNodeComponent,
  AutoDetectBuild: PipelineNodeComponent,
  AppService: PipelineNodeComponent,
  PostgresDatabase: PipelineNodeComponent,
  SpacesBucket: PipelineNodeComponent,
  CustomDomain: PipelineNodeComponent,
  EnvVars: PipelineNodeComponent,
  Secret: PipelineNodeComponent,
};

/**
 * Main React Flow canvas for the visual pipeline builder.
 */
export function PipelineCanvas({
  initialNodes,
  initialEdges,
  compiledYaml,
  isValid,
  validationErrors,
  onSave,
  onCompile,
  onDeploy,
  isSaving,
  isCompiling,
  isDeploying,
}: PipelineCanvasProps): JSX.Element {
  const reactFlowWrapper = useRef<HTMLDivElement>(null);
  const [nodes, setNodes, onNodesChange] = useNodesState(toRFNodes(initialNodes));
  const [edges, setEdges, onEdgesChange] = useEdgesState(toRFEdges(initialEdges));
  const [selectedNode, setSelectedNode] = useState<RFNode | null>(null);
  const [showTemplates, setShowTemplates] = useState(initialNodes.length === 0);

  // Memoize dirty-check
  const hasNodes = nodes.length > 0;

  // Handle new edge connections with type validation
  const onConnect: OnConnect = useCallback(
    (connection: Connection) => {
      const sourceNode = nodes.find((n) => n.id === connection.source);
      const targetNode = nodes.find((n) => n.id === connection.target);

      if (!sourceNode || !targetNode) return;

      const sourceType = sourceNode.type as PipelineNodeType;
      const targetType = targetNode.type as PipelineNodeType;

      if (!isValidConnection(sourceType, targetType)) return;

      setEdges((eds) =>
        addEdge(
          {
            ...connection,
            animated: true,
            style: { stroke: 'hsl(var(--muted-foreground))', strokeWidth: 2 },
            markerEnd: { type: MarkerType.ArrowClosed, color: 'hsl(var(--muted-foreground))' },
          },
          eds,
        ),
      );
    },
    [nodes, setEdges],
  );

  // Selection tracking
  const onSelectionChange = useCallback(
    ({ nodes: selected }: { nodes: RFNode[] }) => {
      setSelectedNode(selected.length === 1 ? (selected[0] ?? null) : null);
    },
    [],
  );

  // Drag-and-drop from palette
  const onDragOver = useCallback((event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
  }, []);

  const onDrop = useCallback(
    (event: DragEvent<HTMLDivElement>) => {
      event.preventDefault();

      const rawData = event.dataTransfer.getData('application/reactflow');
      if (!rawData) return;

      const { type, data } = JSON.parse(rawData) as { type: PipelineNodeType; data: Record<string, unknown> };

      const wrapper = reactFlowWrapper.current;
      if (!wrapper) return;

      const bounds = wrapper.getBoundingClientRect();

      const newNode: RFNode = {
        id: nextId(),
        type,
        data: { ...data },
        position: {
          x: event.clientX - bounds.left - 90,
          y: event.clientY - bounds.top - 30,
        },
      };

      setNodes((nds) => [...nds, newNode]);
    },
    [setNodes],
  );

  // Save handler
  const handleSave = useCallback(() => {
    onSave(fromRFNodes(nodes), fromRFEdges(edges));
  }, [nodes, edges, onSave]);

  // Template selection
  const handleTemplateSelect = useCallback(
    (template: PipelineTemplate) => {
      setNodes(toRFNodes(template.nodes));
      setEdges(toRFEdges(template.edges));
      setShowTemplates(false);
    },
    [setNodes, setEdges],
  );

  // Edge validation display
  const isValidEdgeConnection = useCallback(
    (connection: Edge | Connection) => {
      const sourceNode = nodes.find((n) => n.id === connection.source);
      const targetNode = nodes.find((n) => n.id === connection.target);
      if (!sourceNode || !targetNode) return false;
      return isValidConnection(
        sourceNode.type as PipelineNodeType,
        targetNode.type as PipelineNodeType,
      );
    },
    [nodes],
  );

  // Keep selectedNode in sync with current node data
  const selectedNodeCurrent = useMemo(() => {
    if (!selectedNode) return null;
    return nodes.find((n) => n.id === selectedNode.id) ?? null;
  }, [selectedNode, nodes]);

  return (
    <div className="flex flex-col h-[calc(100vh-8rem)] rounded-xl border border-border overflow-hidden bg-background">
      {/* Toolbar */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-border bg-card/80 backdrop-blur-sm">
        <div className="flex items-center gap-2">
          <h2 className="text-sm font-bold text-foreground tracking-tight">Pipeline Builder</h2>
          <span className="text-[10px] text-muted-foreground bg-accent px-1.5 py-0.5 rounded-full font-medium">
            Visual
          </span>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowTemplates(true)}
            className="px-3 py-1.5 text-xs font-medium rounded-lg border border-border
              text-muted-foreground hover:text-foreground hover:border-foreground/20
              transition-all"
          >
            📋 Templates
          </button>
          <button
            onClick={handleSave}
            disabled={isSaving}
            className="px-3 py-1.5 text-xs font-medium rounded-lg border border-border
              text-foreground hover:bg-accent transition-all disabled:opacity-50"
          >
            {isSaving ? '💾 Saving…' : '💾 Save'}
          </button>
          <button
            onClick={onCompile}
            disabled={isCompiling || !hasNodes}
            className="px-3 py-1.5 text-xs font-medium rounded-lg border border-blue-500/30
              text-blue-500 hover:bg-blue-500/10 transition-all disabled:opacity-50"
          >
            {isCompiling ? '⚙️ Compiling…' : '⚙️ Compile'}
          </button>
          <button
            onClick={onDeploy}
            disabled={isDeploying || !isValid || !hasNodes}
            className="px-3 py-1.5 text-xs font-semibold rounded-lg
              bg-gradient-to-r from-emerald-500 to-teal-500 text-white
              hover:from-emerald-600 hover:to-teal-600 shadow-sm hover:shadow-md
              transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isDeploying ? '🚀 Deploying…' : '🚀 Deploy'}
          </button>
        </div>
      </div>

      {/* Main layout: palette | canvas | config panel */}
      <div className="flex flex-1 min-h-0">
        <NodePalette />

        <div ref={reactFlowWrapper} className="flex-1 min-w-0">
          <ReactFlow
            nodes={nodes}
            edges={edges}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onConnect={onConnect}
            onSelectionChange={onSelectionChange}
            onDragOver={onDragOver}
            onDrop={onDrop}
            isValidConnection={isValidEdgeConnection}
            nodeTypes={nodeTypes}
            fitView
            snapToGrid
            snapGrid={[15, 15]}
            deleteKeyCode={['Backspace', 'Delete']}
            className="pipeline-canvas"
          >
            <Background variant={BackgroundVariant.Dots} gap={15} size={1} color="hsl(var(--muted-foreground) / 0.15)" />
            <Controls className="!bg-card !border-border !rounded-lg !shadow-lg [&>button]:!bg-card [&>button]:!border-border [&>button]:!text-foreground [&>button:hover]:!bg-accent" />
            <MiniMap
              className="!bg-card !border-border !rounded-lg"
              nodeStrokeWidth={3}
              pannable
              zoomable
            />

            {/* Empty state */}
            {!hasNodes && (
              <Panel position="top-center">
                <div className="mt-32 text-center">
                  <p className="text-lg font-bold text-foreground mb-1">Build your pipeline</p>
                  <p className="text-sm text-muted-foreground max-w-md">
                    Drag components from the left palette, or{' '}
                    <button
                      onClick={() => setShowTemplates(true)}
                      className="text-blue-500 hover:underline font-medium"
                    >
                      start from a template
                    </button>
                  </p>
                </div>
              </Panel>
            )}
          </ReactFlow>
        </div>

        {selectedNodeCurrent && <NodeConfigPanel node={selectedNodeCurrent} />}
      </div>

      {/* YAML preview */}
      <YamlPreviewPanel yaml={compiledYaml} isValid={isValid} validationErrors={validationErrors} />

      {/* Template chooser modal */}
      {showTemplates && (
        <TemplateChooser
          onSelect={handleTemplateSelect}
          onClose={() => setShowTemplates(false)}
        />
      )}
    </div>
  );
}

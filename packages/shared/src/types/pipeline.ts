export type PipelineNodeType =
  | 'GitHubPushTrigger'
  | 'ManualTrigger'
  | 'ScheduleTrigger'
  | 'DockerBuild'
  | 'AutoDetectBuild'
  | 'AppService'
  | 'PostgresDatabase'
  | 'SpacesBucket'
  | 'CustomDomain'
  | 'EnvVars'
  | 'Secret';

export interface PipelineNodePosition {
  x: number;
  y: number;
}

export interface PipelineNode {
  id: string;
  type: PipelineNodeType;
  data: Record<string, unknown>;
  position: PipelineNodePosition;
}

export interface PipelineEdge {
  id: string;
  source: string;
  target: string;
  sourceHandle?: string;
  targetHandle?: string;
}

export interface PipelineValidationError {
  nodeId: string;
  field: string;
  message: string;
}

export interface PipelineGraphDto {
  id: string;
  environmentId: string;
  nodes: PipelineNode[];
  edges: PipelineEdge[];
  compiledYaml: string | null;
  isValid: boolean;
  validationErrors: PipelineValidationError[] | null;
  createdAt: string;
  updatedAt: string;
}

export interface SavePipelineInput {
  nodes: PipelineNode[];
  edges: PipelineEdge[];
}

export interface CompilePipelineResult {
  yaml: string;
  config: Record<string, unknown>;
  isValid: boolean;
  validationErrors: PipelineValidationError[];
}

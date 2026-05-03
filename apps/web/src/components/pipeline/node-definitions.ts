import type { PipelineNodeType } from '@liftoff/shared';

/**
 * Category groupings for the node palette.
 */
export type NodeCategory = 'trigger' | 'build' | 'service' | 'infrastructure' | 'config';

export interface NodeDefinition {
  type: PipelineNodeType;
  label: string;
  description: string;
  icon: string;
  category: NodeCategory;
  color: string;
  defaultData: Record<string, unknown>;
}

/**
 * All available pipeline node types and their metadata.
 */
export const NODE_DEFINITIONS: NodeDefinition[] = [
  // Triggers
  {
    type: 'GitHubPushTrigger',
    label: 'GitHub Push',
    description: 'Triggers on push to a branch',
    icon: '🔀',
    category: 'trigger',
    color: '#6366f1',
    defaultData: { branch: 'main' },
  },
  {
    type: 'ManualTrigger',
    label: 'Manual Deploy',
    description: 'Triggered manually from dashboard',
    icon: '👆',
    category: 'trigger',
    color: '#8b5cf6',
    defaultData: {},
  },
  {
    type: 'ScheduleTrigger',
    label: 'Schedule',
    description: 'Cron-based scheduled trigger',
    icon: '⏰',
    category: 'trigger',
    color: '#a855f7',
    defaultData: { cron: '0 2 * * *' },
  },

  // Build
  {
    type: 'DockerBuild',
    label: 'Docker Build',
    description: 'Build from Dockerfile',
    icon: '🐳',
    category: 'build',
    color: '#0891b2',
    defaultData: { dockerfilePath: 'Dockerfile', context: '.' },
  },
  {
    type: 'AutoDetectBuild',
    label: 'Auto Detect',
    description: 'Auto-detect build system',
    icon: '🔍',
    category: 'build',
    color: '#06b6d4',
    defaultData: {},
  },

  // Service
  {
    type: 'AppService',
    label: 'App Service',
    description: 'DigitalOcean App Platform service',
    icon: '🚀',
    category: 'service',
    color: '#059669',
    defaultData: {
      name: 'my-app',
      port: 3000,
      instanceSize: 'apps-s-1vcpu-0.5gb',
      replicas: 1,
      healthCheckPath: '/health',
      region: 'nyc3',
    },
  },

  // Infrastructure
  {
    type: 'PostgresDatabase',
    label: 'PostgreSQL',
    description: 'Managed PostgreSQL database',
    icon: '🗄️',
    category: 'infrastructure',
    color: '#d97706',
    defaultData: { size: 'db-s-1vcpu-1gb', version: '15' },
  },
  {
    type: 'SpacesBucket',
    label: 'Spaces Bucket',
    description: 'DigitalOcean Spaces object storage',
    icon: '📦',
    category: 'infrastructure',
    color: '#ea580c',
    defaultData: { region: 'nyc3' },
  },

  // Config
  {
    type: 'CustomDomain',
    label: 'Custom Domain',
    description: 'Attach a custom domain',
    icon: '🌐',
    category: 'config',
    color: '#dc2626',
    defaultData: { domain: '' },
  },
  {
    type: 'EnvVars',
    label: 'Env Variables',
    description: 'Environment variables for the app',
    icon: '📝',
    category: 'config',
    color: '#e11d48',
    defaultData: { variables: {} },
  },
  {
    type: 'Secret',
    label: 'Secret',
    description: 'Encrypted secret value',
    icon: '🔑',
    category: 'config',
    color: '#be185d',
    defaultData: { name: '' },
  },
];

/**
 * Group definitions by category for the palette.
 */
export const NODE_CATEGORIES: { label: string; category: NodeCategory; color: string }[] = [
  { label: 'Triggers', category: 'trigger', color: '#6366f1' },
  { label: 'Build', category: 'build', color: '#0891b2' },
  { label: 'Services', category: 'service', color: '#059669' },
  { label: 'Infrastructure', category: 'infrastructure', color: '#d97706' },
  { label: 'Config', category: 'config', color: '#dc2626' },
];

/**
 * Find a node definition by its type.
 */
export function getNodeDefinition(type: PipelineNodeType): NodeDefinition | undefined {
  return NODE_DEFINITIONS.find((d) => d.type === type);
}

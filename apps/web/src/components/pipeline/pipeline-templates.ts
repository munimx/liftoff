import type { PipelineNode, PipelineEdge } from '@liftoff/shared';

export interface PipelineTemplate {
  id: string;
  name: string;
  description: string;
  icon: string;
  nodes: PipelineNode[];
  edges: PipelineEdge[];
}

/**
 * Pre-built pipeline templates users can start from.
 */
export const PIPELINE_TEMPLATES: PipelineTemplate[] = [
  {
    id: 'simple-web-app',
    name: 'Simple Web App',
    description: 'GitHub push → Docker build → App Service',
    icon: '🌐',
    nodes: [
      {
        id: 'trigger-1',
        type: 'GitHubPushTrigger',
        data: { branch: 'main' },
        position: { x: 50, y: 200 },
      },
      {
        id: 'build-1',
        type: 'DockerBuild',
        data: { dockerfilePath: 'Dockerfile', context: '.' },
        position: { x: 320, y: 200 },
      },
      {
        id: 'app-1',
        type: 'AppService',
        data: {
          name: 'my-web-app',
          port: 3000,
          instanceSize: 'apps-s-1vcpu-0.5gb',
          replicas: 1,
          healthCheckPath: '/health',
          region: 'nyc3',
        },
        position: { x: 590, y: 200 },
      },
    ],
    edges: [
      { id: 'e-trigger-build', source: 'trigger-1', target: 'build-1' },
      { id: 'e-build-app', source: 'build-1', target: 'app-1' },
    ],
  },
  {
    id: 'web-app-with-db',
    name: 'Web App + Database',
    description: 'Full-stack app with PostgreSQL and env vars',
    icon: '🗄️',
    nodes: [
      {
        id: 'trigger-1',
        type: 'GitHubPushTrigger',
        data: { branch: 'main' },
        position: { x: 50, y: 200 },
      },
      {
        id: 'build-1',
        type: 'DockerBuild',
        data: { dockerfilePath: 'Dockerfile', context: '.' },
        position: { x: 320, y: 200 },
      },
      {
        id: 'app-1',
        type: 'AppService',
        data: {
          name: 'my-fullstack-app',
          port: 3000,
          instanceSize: 'apps-s-1vcpu-1gb',
          replicas: 1,
          healthCheckPath: '/health',
          region: 'nyc3',
        },
        position: { x: 590, y: 200 },
      },
      {
        id: 'db-1',
        type: 'PostgresDatabase',
        data: { size: 'db-s-1vcpu-1gb', version: '15' },
        position: { x: 340, y: 380 },
      },
      {
        id: 'env-1',
        type: 'EnvVars',
        data: { variables: { NODE_ENV: 'production' } },
        position: { x: 340, y: 50 },
      },
    ],
    edges: [
      { id: 'e-trigger-build', source: 'trigger-1', target: 'build-1' },
      { id: 'e-build-app', source: 'build-1', target: 'app-1' },
      { id: 'e-db-app', source: 'db-1', target: 'app-1' },
      { id: 'e-env-app', source: 'env-1', target: 'app-1' },
    ],
  },
  {
    id: 'production-stack',
    name: 'Production Stack',
    description: 'Full production setup with DB, storage, domain, and secrets',
    icon: '🏭',
    nodes: [
      {
        id: 'trigger-1',
        type: 'GitHubPushTrigger',
        data: { branch: 'main' },
        position: { x: 50, y: 250 },
      },
      {
        id: 'build-1',
        type: 'DockerBuild',
        data: { dockerfilePath: 'Dockerfile', context: '.' },
        position: { x: 320, y: 250 },
      },
      {
        id: 'app-1',
        type: 'AppService',
        data: {
          name: 'production-app',
          port: 8080,
          instanceSize: 'apps-s-2vcpu-4gb',
          replicas: 2,
          healthCheckPath: '/api/health',
          region: 'nyc3',
        },
        position: { x: 640, y: 250 },
      },
      {
        id: 'db-1',
        type: 'PostgresDatabase',
        data: { size: 'db-s-2vcpu-4gb', version: '16' },
        position: { x: 380, y: 440 },
      },
      {
        id: 'storage-1',
        type: 'SpacesBucket',
        data: { region: 'nyc3' },
        position: { x: 380, y: 560 },
      },
      {
        id: 'domain-1',
        type: 'CustomDomain',
        data: { domain: 'app.example.com' },
        position: { x: 380, y: 60 },
      },
      {
        id: 'env-1',
        type: 'EnvVars',
        data: { variables: { NODE_ENV: 'production', LOG_LEVEL: 'info' } },
        position: { x: 640, y: 60 },
      },
      {
        id: 'secret-1',
        type: 'Secret',
        data: { name: 'DATABASE_URL' },
        position: { x: 640, y: 440 },
      },
    ],
    edges: [
      { id: 'e-trigger-build', source: 'trigger-1', target: 'build-1' },
      { id: 'e-build-app', source: 'build-1', target: 'app-1' },
      { id: 'e-db-app', source: 'db-1', target: 'app-1' },
      { id: 'e-storage-app', source: 'storage-1', target: 'app-1' },
      { id: 'e-domain-app', source: 'domain-1', target: 'app-1' },
      { id: 'e-env-app', source: 'env-1', target: 'app-1' },
      { id: 'e-secret-app', source: 'secret-1', target: 'app-1' },
    ],
  },
  {
    id: 'scheduled-job',
    name: 'Scheduled Job',
    description: 'Cron-triggered worker with auto-detect build',
    icon: '⏰',
    nodes: [
      {
        id: 'trigger-1',
        type: 'ScheduleTrigger',
        data: { cron: '0 2 * * *' },
        position: { x: 50, y: 200 },
      },
      {
        id: 'build-1',
        type: 'AutoDetectBuild',
        data: {},
        position: { x: 320, y: 200 },
      },
      {
        id: 'app-1',
        type: 'AppService',
        data: {
          name: 'cron-worker',
          port: 8080,
          instanceSize: 'apps-s-1vcpu-0.5gb',
          replicas: 1,
          healthCheckPath: '/health',
          region: 'nyc3',
        },
        position: { x: 590, y: 200 },
      },
    ],
    edges: [
      { id: 'e-trigger-build', source: 'trigger-1', target: 'build-1' },
      { id: 'e-build-app', source: 'build-1', target: 'app-1' },
    ],
  },
];

import { PipelineCompilerService } from './pipeline-compiler.service';
import type { PipelineNode, PipelineEdge } from '@liftoff/shared';

describe('PipelineCompilerService', () => {
  let compiler: PipelineCompilerService;

  beforeEach(() => {
    compiler = new PipelineCompilerService();
  });

  describe('validate', () => {
    it('returns error when no app service node exists', () => {
      const nodes: PipelineNode[] = [
        { id: '1', type: 'GitHubPushTrigger', data: {}, position: { x: 0, y: 0 } },
      ];
      const errors = compiler.validate(nodes, []);
      expect(errors).toHaveLength(1);
      expect(errors[0]!.message).toContain('App Service');
    });

    it('returns error for missing app name', () => {
      const nodes: PipelineNode[] = [
        { id: '1', type: 'AppService', data: { port: 3000 }, position: { x: 0, y: 0 } },
      ];
      const errors = compiler.validate(nodes, []);
      expect(errors.some((e) => e.field === 'name')).toBe(true);
    });

    it('returns error for invalid app name format', () => {
      const nodes: PipelineNode[] = [
        { id: '1', type: 'AppService', data: { name: 'INVALID', port: 3000 }, position: { x: 0, y: 0 } },
      ];
      const errors = compiler.validate(nodes, []);
      expect(errors.some((e) => e.field === 'name')).toBe(true);
    });

    it('returns error for invalid port', () => {
      const nodes: PipelineNode[] = [
        { id: '1', type: 'AppService', data: { name: 'my-app', port: 0 }, position: { x: 0, y: 0 } },
      ];
      const errors = compiler.validate(nodes, []);
      expect(errors.some((e) => e.field === 'port')).toBe(true);
    });

    it('returns error when trigger connects to non-build node', () => {
      const nodes: PipelineNode[] = [
        { id: '1', type: 'GitHubPushTrigger', data: {}, position: { x: 0, y: 0 } },
        { id: '2', type: 'AppService', data: { name: 'my-app', port: 3000 }, position: { x: 200, y: 0 } },
      ];
      const edges: PipelineEdge[] = [{ id: 'e1', source: '1', target: '2' }];
      const errors = compiler.validate(nodes, edges);
      expect(errors.some((e) => e.message.includes('build'))).toBe(true);
    });

    it('returns no errors for a valid graph', () => {
      const nodes: PipelineNode[] = [
        { id: '1', type: 'GitHubPushTrigger', data: {}, position: { x: 0, y: 0 } },
        { id: '2', type: 'DockerBuild', data: {}, position: { x: 200, y: 0 } },
        { id: '3', type: 'AppService', data: { name: 'my-app', port: 3000 }, position: { x: 400, y: 0 } },
      ];
      const edges: PipelineEdge[] = [
        { id: 'e1', source: '1', target: '2' },
        { id: 'e2', source: '2', target: '3' },
      ];
      const errors = compiler.validate(nodes, edges);
      expect(errors).toHaveLength(0);
    });
  });

  describe('compile', () => {
    it('compiles a simple app service into LiftoffConfig YAML', () => {
      const nodes: PipelineNode[] = [
        { id: '1', type: 'AppService', data: { name: 'my-api', port: 4000 }, position: { x: 0, y: 0 } },
      ];
      const result = compiler.compile(nodes, []);
      expect(result.isValid).toBe(true);
      expect(result.yaml).toContain('my-api');
      expect(result.config).toHaveProperty('service');
    });

    it('enables database when PostgresDatabase connects to AppService', () => {
      const nodes: PipelineNode[] = [
        { id: '1', type: 'AppService', data: { name: 'my-api', port: 4000 }, position: { x: 0, y: 0 } },
        { id: '2', type: 'PostgresDatabase', data: { size: 'db-s-2vcpu-4gb' }, position: { x: 0, y: 200 } },
      ];
      const edges: PipelineEdge[] = [{ id: 'e1', source: '2', target: '1' }];
      const result = compiler.compile(nodes, edges);
      expect(result.isValid).toBe(true);
      expect(result.config).toHaveProperty('database');
      const db = result.config['database'] as Record<string, unknown>;
      expect(db['enabled']).toBe(true);
      expect(db['size']).toBe('db-s-2vcpu-4gb');
    });

    it('enables storage when SpacesBucket connects to AppService', () => {
      const nodes: PipelineNode[] = [
        { id: '1', type: 'AppService', data: { name: 'my-api', port: 4000 }, position: { x: 0, y: 0 } },
        { id: '2', type: 'SpacesBucket', data: { region: 'sfo3' }, position: { x: 0, y: 200 } },
      ];
      const edges: PipelineEdge[] = [{ id: 'e1', source: '2', target: '1' }];
      const result = compiler.compile(nodes, edges);
      expect(result.isValid).toBe(true);
      const storage = result.config['storage'] as Record<string, unknown>;
      expect(storage['enabled']).toBe(true);
    });

    it('merges env vars from EnvVars node', () => {
      const nodes: PipelineNode[] = [
        { id: '1', type: 'AppService', data: { name: 'my-api', port: 4000 }, position: { x: 0, y: 0 } },
        { id: '2', type: 'EnvVars', data: { variables: { NODE_ENV: 'production', API_KEY: 'test' } }, position: { x: 0, y: 200 } },
      ];
      const edges: PipelineEdge[] = [{ id: 'e1', source: '2', target: '1' }];
      const result = compiler.compile(nodes, edges);
      expect(result.isValid).toBe(true);
      const env = result.config['env'] as Record<string, string>;
      expect(env['NODE_ENV']).toBe('production');
      expect(env['API_KEY']).toBe('test');
    });

    it('collects secrets from Secret nodes', () => {
      const nodes: PipelineNode[] = [
        { id: '1', type: 'AppService', data: { name: 'my-api', port: 4000 }, position: { x: 0, y: 0 } },
        { id: '2', type: 'Secret', data: { name: 'JWT_SECRET' }, position: { x: 0, y: 200 } },
      ];
      const edges: PipelineEdge[] = [{ id: 'e1', source: '2', target: '1' }];
      const result = compiler.compile(nodes, edges);
      expect(result.isValid).toBe(true);
      const secrets = result.config['secrets'] as string[];
      expect(secrets).toContain('JWT_SECRET');
    });

    it('sets domain from CustomDomain node', () => {
      const nodes: PipelineNode[] = [
        { id: '1', type: 'AppService', data: { name: 'my-api', port: 4000 }, position: { x: 0, y: 0 } },
        { id: '2', type: 'CustomDomain', data: { domain: 'api.example.com' }, position: { x: 0, y: 200 } },
      ];
      const edges: PipelineEdge[] = [{ id: 'e1', source: '2', target: '1' }];
      const result = compiler.compile(nodes, edges);
      expect(result.isValid).toBe(true);
      const domain = result.config['domain'] as Record<string, string>;
      expect(domain['name']).toBe('api.example.com');
    });

    it('uses Dockerfile settings from DockerBuild node', () => {
      const nodes: PipelineNode[] = [
        { id: '1', type: 'AppService', data: { name: 'my-api', port: 4000 }, position: { x: 0, y: 0 } },
        { id: '2', type: 'DockerBuild', data: { dockerfilePath: 'docker/Dockerfile.prod', context: 'backend' }, position: { x: 0, y: 200 } },
      ];
      const edges: PipelineEdge[] = [{ id: 'e1', source: '2', target: '1' }];
      const result = compiler.compile(nodes, edges);
      expect(result.isValid).toBe(true);
      const build = result.config['build'] as Record<string, string>;
      expect(build['dockerfile_path']).toBe('docker/Dockerfile.prod');
      expect(build['context']).toBe('backend');
    });

    it('returns invalid result for empty graph', () => {
      const result = compiler.compile([], []);
      expect(result.isValid).toBe(false);
    });
  });
});

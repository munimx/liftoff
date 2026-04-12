import { parseLiftoffConfig } from '@liftoff/shared';

/**
 * Unit tests for LiftoffConfigSchema build settings.
 */
describe('LiftoffConfigSchema build settings', () => {
  it('applies backward-compatible build defaults', () => {
    const config = parseLiftoffConfig({
      version: '1.0',
      service: {
        name: 'my-app',
        type: 'app',
      },
      runtime: {
        port: 3000,
      },
    });

    expect(config.build.dockerfile_path).toBe('Dockerfile');
    expect(config.build.context).toBe('.');
  });

  it('parses custom build dockerfile_path and context', () => {
    const config = parseLiftoffConfig({
      version: '1.0',
      service: {
        name: 'my-app',
        type: 'app',
      },
      runtime: {
        port: 3000,
      },
      build: {
        dockerfile_path: './deploy/Dockerfile',
        context: './apps/web',
      },
    });

    expect(config.build.dockerfile_path).toBe('./deploy/Dockerfile');
    expect(config.build.context).toBe('./apps/web');
  });
});

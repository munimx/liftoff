import { WorkflowGeneratorService } from './workflow-generator.service';

/**
 * Unit tests for WorkflowGeneratorService.
 */
describe('WorkflowGeneratorService', () => {
  let service: WorkflowGeneratorService;

  beforeEach(() => {
    service = new WorkflowGeneratorService();
  });

  it('generates a DigitalOcean workflow with deploy callback', () => {
    const workflow = service.generate({
      projectName: 'my-app',
      environmentId: 'env-1',
      branch: 'main',
      docrName: 'liftoff',
      imageRepository: 'my-app/production',
      liftoffApiUrl: 'https://liftoff.example.com/',
      dockerfilePath: './deploy/Dockerfile',
      dockerBuildContext: './apps/web',
      deploySecretName: 'LIFTOFF_DEPLOY_SECRET_ENV_1',
    });

    expect(workflow).toContain("branches: ['main']");
    expect(workflow).toContain('digitalocean/action-doctl@v2');
    expect(workflow).toContain(
      'registry.digitalocean.com/liftoff/my-app/production:$IMAGE_TAG',
    );
    expect(workflow).toContain('-f ./deploy/Dockerfile');
    expect(workflow).toContain('./apps/web');
    expect(workflow).toContain('https://liftoff.example.com/api/v1/webhooks/deploy-complete');
    expect(workflow).toContain('secrets.LIFTOFF_DEPLOY_SECRET_ENV_1');
  });
});

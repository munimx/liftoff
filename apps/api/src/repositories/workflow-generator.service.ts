import { Injectable } from '@nestjs/common';

/**
 * Workflow generation configuration.
 */
export interface GenerateWorkflowConfig {
  projectName: string;
  environmentId: string;
  branch: string;
  docrName: string;
  imageRepository: string;
  liftoffApiUrl: string;
  dockerfilePath: string;
  dockerBuildContext: string;
  deploySecretName: string;
}

/**
 * Generates a GitHub Actions workflow for Liftoff image build + deploy notification.
 */
@Injectable()
export class WorkflowGeneratorService {
  /**
   * Returns workflow YAML content for `.github/workflows/liftoff-deploy.yml`.
   */
  public generate(config: GenerateWorkflowConfig): string {
    const branch = this.escapeYamlSingleQuoted(config.branch);
    const environmentId = this.escapeJsonString(config.environmentId);
    const imageRepository = this.escapeJsonString(config.imageRepository);
    const docrName = this.escapeJsonString(config.docrName);
    const liftoffApiUrl = this.trimTrailingSlash(config.liftoffApiUrl);
    const dockerfilePath = this.escapeJsonString(config.dockerfilePath);
    const dockerBuildContext = this.escapeJsonString(config.dockerBuildContext);
    const deploySecretName = this.escapeGitHubSecretName(config.deploySecretName);

    return `name: Liftoff Deploy

on:
  push:
    branches: ['${branch}']

jobs:
  build-and-deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Install doctl
        uses: digitalocean/action-doctl@v2
        with:
          token: \${{ secrets.DIGITALOCEAN_ACCESS_TOKEN }}

      - name: Log in to DigitalOcean Container Registry
        run: doctl registry login --expiry-seconds 1200

      - name: Build and push Docker image
        env:
          IMAGE_TAG: \${{ github.sha }}
        run: |
          docker build \\
            -f ${dockerfilePath} \\
            -t registry.digitalocean.com/${docrName}/${imageRepository}:$IMAGE_TAG \\
            ${dockerBuildContext}
          docker push registry.digitalocean.com/${docrName}/${imageRepository}:$IMAGE_TAG

      - name: Notify Liftoff
        env:
          IMAGE_TAG: \${{ github.sha }}
        run: |
          curl -X POST ${liftoffApiUrl}/api/v1/webhooks/deploy-complete \\
            -H "X-Liftoff-Secret: \${{ secrets.${deploySecretName} }}" \\
            -H "Content-Type: application/json" \\
            -d "{\\"environmentId\\":\\"${environmentId}\\",\\"imageUri\\":\\"registry.digitalocean.com/${docrName}/${imageRepository}:$IMAGE_TAG\\",\\"commitSha\\":\\"$GITHUB_SHA\\"}"
`;
  }

  private trimTrailingSlash(url: string): string {
    return url.endsWith('/') ? url.slice(0, -1) : url;
  }

  private escapeYamlSingleQuoted(value: string): string {
    return value.replace(/'/g, "''");
  }

  private escapeJsonString(value: string): string {
    return value.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
  }

  private escapeGitHubSecretName(value: string): string {
    return value.replace(/[^A-Z0-9_]/g, '_');
  }
}

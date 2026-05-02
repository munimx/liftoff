import { Injectable } from '@nestjs/common';
import { LIFTOFF_DEPLOY_SECRET_NAME } from '@liftoff/shared';
import { DoApiService } from '../do-api/do-api.service';

/**
 * Workflow generation configuration.
 */
export interface GenerateWorkflowConfig {
  projectName: string;
  environmentId: string;
  branch: string;
  imageRepository: string;
  liftoffApiUrl: string;
  dockerfilePath: string;
  dockerBuildContext: string;
  doToken: string;
  doAccountId?: string;
  githubRunsUrl?: string;
}

/**
 * Generates a GitHub Actions workflow for Liftoff image build + deploy notification.
 */
@Injectable()
export class WorkflowGeneratorService {
  public constructor(private readonly doApiService: DoApiService) {}

  /**
   * Returns workflow YAML content for `.github/workflows/liftoff-deploy.yml`.
   */
  public async generate(config: GenerateWorkflowConfig): Promise<string> {
    const registryName = await this.doApiService.getOrCreateContainerRegistryName(
      config.doToken,
      config.doAccountId,
    );
    const branch = this.escapeYamlSingleQuoted(config.branch);
    const environmentId = this.escapeJsonString(config.environmentId);
    const imageRepository = this.escapeJsonString(config.imageRepository);
    const docrName = this.escapeJsonString(registryName);
    const liftoffApiUrl = this.trimTrailingSlash(config.liftoffApiUrl);
    const dockerfilePath = this.escapeJsonString(config.dockerfilePath);
    const dockerBuildContext = this.escapeJsonString(config.dockerBuildContext);

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
            -t registry.digitalocean.com/${docrName}/${imageRepository}:\$IMAGE_TAG \\
            ${dockerBuildContext}
          docker push registry.digitalocean.com/${docrName}/${imageRepository}:\$IMAGE_TAG

      - name: Notify Liftoff
        if: always()
        env:
          IMAGE_TAG: \${{ github.sha }}
          JOB_STATUS: \${{ job.status }}
          RUN_URL: \${{ github.server_url }}/\${{ github.repository }}/actions/runs/\${{ github.run_id }}
        run: |
          curl -X POST ${liftoffApiUrl}/api/v1/webhooks/deploy-complete \\
            -H "X-Liftoff-Secret: \${{ secrets.${LIFTOFF_DEPLOY_SECRET_NAME} }}" \\
            -H "Content-Type: application/json" \\
            -d "{\\"environmentId\\":\\"${environmentId}\\",\\"imageUri\\":\\"registry.digitalocean.com/${docrName}/${imageRepository}:\$IMAGE_TAG\\",\\"commitSha\\":\\"$GITHUB_SHA\\",\\"status\\":\\"$JOB_STATUS\\",\\"runUrl\\":\\"$RUN_URL\\"}"
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
}

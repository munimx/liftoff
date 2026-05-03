import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomBytes } from 'crypto';
import AdmZip from 'adm-zip';
import {
  APP_TYPE_DEFAULTS,
  ErrorCodes,
  SIZE_TIER_INSTANCE_SIZES,
  TEMPLATES,
  getDockerfileTemplate,
  type AppType,
  type SizeTier,
} from '@liftoff/shared';
import { Exceptions } from '../common/exceptions/app.exception';
import { EncryptionService } from '../common/services/encryption.service';
import { PrismaService } from '../prisma/prisma.service';
import { ProjectsService } from '../projects/projects.service';
import { EnvironmentsService } from '../environments/environments.service';
import { DeploymentsService } from '../deployments/deployments.service';
import { GitHubService } from '../repositories/github.service';
import { DoApiService } from '../do-api/do-api.service';

const MAX_ZIP_SIZE_BYTES = 50 * 1024 * 1024;

export interface UploadResult {
  deploymentId: string;
  repositoryUrl: string;
  statusUrl: string;
}

/**
 * Orchestrates zip upload → GitHub repo → deployment for Simple Mode.
 */
@Injectable()
export class UploadService {
  private readonly logger = new Logger(UploadService.name);

  public constructor(
    private readonly prismaService: PrismaService,
    private readonly projectsService: ProjectsService,
    private readonly environmentsService: EnvironmentsService,
    private readonly deploymentsService: DeploymentsService,
    private readonly githubService: GitHubService,
    private readonly encryptionService: EncryptionService,
    private readonly configService: ConfigService,
    private readonly doApiService: DoApiService,
  ) {}

  /**
   * Handles a user-uploaded zip: creates project, repo, environment, and triggers deployment.
   */
  public async handleUpload(
    userId: string,
    file: Express.Multer.File,
    appType: AppType,
    size: SizeTier,
    database: boolean,
    domain: string | undefined,
    projectName: string,
    projectDescription: string | undefined,
    doAccountId: string,
  ): Promise<UploadResult> {
    this.validateZip(file);

    const githubToken = await this.getGitHubToken(userId);
    const files = this.extractZip(file.buffer, appType);

    const project = await this.projectsService.create(userId, {
      name: projectName,
      description: projectDescription,
    });

    const repoName = `liftoff-${projectName}`;
    const repo = await this.githubService.createRepository(githubToken, repoName, true);

    const commitSha = await this.githubService.pushFiles(
      githubToken,
      repo.fullName,
      files,
      'Initial commit via Liftoff',
      repo.defaultBranch,
    );

    const webhookSecret = randomBytes(20).toString('hex');
    const encryptedWebhookSecret = this.encryptionService.encrypt(webhookSecret);
    const webhookUrl = `${this.configService.getOrThrow<string>('WEBHOOK_BASE_URL')}/api/v1/webhooks/github`;

    let webhookId: number;
    try {
      webhookId = await this.githubService.createWebhook(
        githubToken,
        repo.fullName,
        webhookUrl,
        webhookSecret,
      );
    } catch {
      this.logger.warn(`Failed to create webhook for ${repo.fullName}`);
      webhookId = 0;
    }

    await this.prismaService.repository.create({
      data: {
        projectId: project.id,
        githubId: repo.id,
        fullName: repo.fullName,
        cloneUrl: repo.cloneUrl,
        branch: repo.defaultBranch,
        webhookId: webhookId || null,
        webhookSecret: encryptedWebhookSecret,
      },
    });

    const environment = await this.environmentsService.create(project.id, userId, {
      name: 'production',
      gitBranch: repo.defaultBranch,
      doAccountId,
      serviceType: 'APP',
    });

    const configParsed = this.buildConfigParsed(appType, size, database, domain, projectName);
    await this.prismaService.environment.update({
      where: { id: environment.id },
      data: { configParsed },
    });

    const deployment = await this.deploymentsService.trigger(environment.id, userId, {
      commitSha,
      commitMessage: 'Initial commit via Liftoff',
      branch: repo.defaultBranch,
    });

    return {
      deploymentId: deployment.id,
      repositoryUrl: `https://github.com/${repo.fullName}`,
      statusUrl: `/deploy/${deployment.id}/status`,
    };
  }

  /**
   * Deploys a starter template by downloading from DO Spaces and running the upload flow.
   */
  public async handleTemplateDeploy(
    userId: string,
    templateSlug: string,
    projectName: string,
    doAccountId: string,
  ): Promise<UploadResult> {
    const template = TEMPLATES.find((t) => t.slug === templateSlug);
    if (!template) {
      throw Exceptions.notFound('Template not found', ErrorCodes.TEMPLATE_NOT_FOUND);
    }

    const bucket = this.configService.getOrThrow<string>('DO_SPACES_BUCKET');
    const zipBuffer = await this.doApiService.getSpacesObject(bucket, template.spacesKey);

    const file: Express.Multer.File = {
      buffer: zipBuffer,
      size: zipBuffer.length,
      originalname: `${template.slug}.zip`,
      mimetype: 'application/zip',
      fieldname: 'file',
      encoding: '7bit',
      destination: '',
      filename: '',
      path: '',
      stream: null as never,
    };

    return this.handleUpload(
      userId,
      file,
      template.appType as AppType,
      'small',
      false,
      undefined,
      projectName,
      template.description,
      doAccountId,
    );
  }

  private validateZip(file: Express.Multer.File): void {
    if (file.size > MAX_ZIP_SIZE_BYTES) {
      throw Exceptions.badRequest(
        'File exceeds the 50MB limit',
        ErrorCodes.UPLOAD_FILE_TOO_LARGE,
      );
    }

    if (!file.originalname.endsWith('.zip') && file.mimetype !== 'application/zip') {
      throw Exceptions.badRequest(
        'Only .zip files are accepted',
        ErrorCodes.UPLOAD_INVALID_FORMAT,
      );
    }
  }

  private extractZip(
    buffer: Buffer,
    appType: AppType,
  ): Array<{ path: string; content: string }> {
    const zip = new AdmZip(buffer);
    const entries = zip.getEntries();

    const files: Array<{ path: string; content: string }> = [];
    let hasDockerfile = false;

    const rootPrefix = this.detectRootPrefix(entries);

    for (const entry of entries) {
      if (entry.isDirectory) continue;

      let entryPath = entry.entryName;
      if (rootPrefix && entryPath.startsWith(rootPrefix)) {
        entryPath = entryPath.slice(rootPrefix.length);
      }

      if (!entryPath || entryPath.startsWith('..') || entryPath.includes('/../')) continue;
      if (entryPath.startsWith('__MACOSX/') || entryPath.startsWith('.DS_Store')) continue;

      if (entryPath === 'Dockerfile') hasDockerfile = true;

      const content = entry.getData().toString('base64');
      files.push({ path: entryPath, content });
    }

    if (files.length === 0) {
      throw Exceptions.badRequest('The zip archive is empty', ErrorCodes.UPLOAD_EMPTY_ARCHIVE);
    }

    if (!hasDockerfile) {
      const dockerfileContent = getDockerfileTemplate(appType);
      if (dockerfileContent) {
        files.push({
          path: 'Dockerfile',
          content: Buffer.from(dockerfileContent).toString('base64'),
        });
      }
    }

    return files;
  }

  private detectRootPrefix(entries: AdmZip.IZipEntry[]): string {
    const paths = entries.map((e) => e.entryName).filter((p) => !p.startsWith('__MACOSX'));
    const first = paths[0];
    if (!first) return '';

    const firstSlash = first.indexOf('/');
    if (firstSlash === -1) return '';

    const candidate = first.slice(0, firstSlash + 1);
    if (paths.every((p) => p.startsWith(candidate))) return candidate;

    return '';
  }

  private buildConfigParsed(
    appType: AppType,
    size: SizeTier,
    database: boolean,
    domain: string | undefined,
    serviceName: string,
  ): object {
    const defaults = APP_TYPE_DEFAULTS[appType];
    const instanceSize = SIZE_TIER_INSTANCE_SIZES[size];

    return {
      version: '1.0',
      service: { name: serviceName, type: 'app', region: 'nyc3' },
      runtime: { instance_size: instanceSize, port: defaults.port, replicas: 1 },
      env: {},
      secrets: [],
      build: { dockerfile_path: 'Dockerfile', context: '.' },
      database: { enabled: database, engine: 'postgres', version: '15', size: 'db-s-1vcpu-1gb' },
      storage: { enabled: false },
      healthcheck: { path: defaults.healthcheckPath, interval: 30, timeout: 5 },
      ...(domain ? { domain: { name: domain } } : {}),
    };
  }

  private async getGitHubToken(userId: string): Promise<string> {
    const user = await this.prismaService.user.findUnique({
      where: { id: userId },
      select: { githubToken: true },
    });

    if (!user?.githubToken) {
      throw Exceptions.badRequest(
        'GitHub account is not connected',
        ErrorCodes.AUTH_GITHUB_FAILED,
      );
    }

    return user.githubToken;
  }
}

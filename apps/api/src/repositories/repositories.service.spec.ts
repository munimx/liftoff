import { Role } from '@prisma/client';
import { resolveEnvironmentDeploySecretName } from '@liftoff/shared';
import { ConfigService } from '@nestjs/config';
import { EncryptionService } from '../common/services/encryption.service';
import { PrismaService } from '../prisma/prisma.service';
import { ProjectsService } from '../projects/projects.service';
import { GitHubService } from './github.service';
import { RepositoriesService } from './repositories.service';
import { WorkflowGeneratorService } from './workflow-generator.service';

const now = new Date('2025-01-01T00:00:00.000Z');

/**
 * Unit tests for RepositoriesService.
 */
describe('RepositoriesService', () => {
  let service: RepositoriesService;

  const transactionMock = {
    repository: {
      create: jest.fn(),
    },
    environment: {
      update: jest.fn(),
    },
  };

  const prismaServiceMock = {
    repository: {
      findUnique: jest.fn(),
      findMany: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
    user: {
      findFirst: jest.fn(),
    },
    project: {
      findFirst: jest.fn(),
    },
    environment: {
      findUnique: jest.fn(),
    },
    $transaction: jest.fn(),
  };

  const projectsServiceMock = {
    assertProjectRole: jest.fn(),
  };

  const encryptionServiceMock = {
    encrypt: jest.fn((_value: string) => 'encrypted-value'),
    decrypt: jest.fn((_value: string) => 'decrypted-value'),
  };

  const githubServiceMock = {
    getRepository: jest.fn(),
    getWebhook: jest.fn(),
    createWebhook: jest.fn(),
    updateWebhookUrl: jest.fn(),
    upsertActionsSecret: jest.fn(),
    commitFile: jest.fn(),
    deleteWebhook: jest.fn(),
    listRepositories: jest.fn(),
  };

  const workflowGeneratorServiceMock = {
    generate: jest.fn(() => 'workflow-content'),
  };

  const configServiceMock = {
    getOrThrow: jest.fn((key: string) => {
      if (key === 'WEBHOOK_BASE_URL') {
        return 'https://liftoff.example.com';
      }

      if (key === 'DOCR_NAME') {
        return 'liftoff';
      }

      return '';
    }),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    prismaServiceMock.$transaction.mockImplementation(
      async (callback: (transaction: typeof transactionMock) => Promise<unknown>) =>
        callback(transactionMock),
    );

    service = new RepositoriesService(
      prismaServiceMock as unknown as PrismaService,
      projectsServiceMock as unknown as ProjectsService,
      encryptionServiceMock as unknown as EncryptionService,
      githubServiceMock as unknown as GitHubService,
      workflowGeneratorServiceMock as unknown as WorkflowGeneratorService,
      configServiceMock as unknown as ConfigService,
    );
  });

  it('connect creates webhook, stores repository, and commits workflow', async () => {
    projectsServiceMock.assertProjectRole.mockResolvedValue(Role.OWNER);
    prismaServiceMock.repository.findUnique.mockResolvedValue(null);
    prismaServiceMock.user.findFirst.mockResolvedValue({ githubToken: 'encrypted-github-token' });
    githubServiceMock.getRepository.mockResolvedValue({
      id: 123,
      name: 'my-app',
      fullName: 'liftoff/my-app',
      private: false,
      defaultBranch: 'main',
      cloneUrl: 'https://github.com/liftoff/my-app.git',
      htmlUrl: 'https://github.com/liftoff/my-app',
    });
    prismaServiceMock.project.findFirst.mockResolvedValue({
      id: 'project-1',
      name: 'my-app',
      environments: [
        {
          id: 'env-1',
          name: 'production',
          gitBranch: 'main',
          liftoffDeploySecret: null,
          configParsed: null,
        },
      ],
    });
    githubServiceMock.createWebhook.mockResolvedValue(555);
    transactionMock.repository.create.mockResolvedValue({
      id: 'repo-1',
      projectId: 'project-1',
      githubId: 123,
      fullName: 'liftoff/my-app',
      cloneUrl: 'https://github.com/liftoff/my-app.git',
      branch: 'main',
      webhookId: 555,
      webhookSecret: 'encrypted-secret',
      createdAt: now,
      updatedAt: now,
    });
    transactionMock.environment.update.mockResolvedValue(undefined);
    githubServiceMock.upsertActionsSecret.mockResolvedValue(undefined);
    githubServiceMock.commitFile.mockResolvedValue(undefined);

    const result = await service.connect('project-1', 'user-1', {
      githubRepoId: 123,
      fullName: 'liftoff/my-app',
      branch: 'main',
    });

    expect(githubServiceMock.createWebhook).toHaveBeenCalledWith(
      'decrypted-value',
      'liftoff/my-app',
      'https://liftoff.example.com/api/v1/webhooks/github',
      expect.any(String),
    );
    expect(workflowGeneratorServiceMock.generate).toHaveBeenCalledWith({
      projectName: 'my-app',
      environmentId: 'env-1',
      branch: 'main',
      docrName: 'liftoff',
      imageRepository: 'my-app/production',
      liftoffApiUrl: 'https://liftoff.example.com',
      dockerfilePath: 'Dockerfile',
      dockerBuildContext: '.',
      deploySecretName: resolveEnvironmentDeploySecretName('env-1'),
    });
    expect(githubServiceMock.commitFile).toHaveBeenCalledWith(
      'decrypted-value',
      'liftoff/my-app',
      '.github/workflows/liftoff-deploy.yml',
      'workflow-content',
      expect.stringContaining('Required GitHub Secrets'),
      'main',
    );
    expect(githubServiceMock.upsertActionsSecret).toHaveBeenCalledWith(
      'decrypted-value',
      'liftoff/my-app',
      resolveEnvironmentDeploySecretName('env-1'),
      expect.stringMatching(/^[0-9a-f]{40}$/),
    );
    expect(result.fullName).toBe('liftoff/my-app');
    expect(result.branch).toBe('main');
    expect(result.webhookStatus).toBe('active');
  });

  it('connect returns actionable error when workflow scope is missing', async () => {
    projectsServiceMock.assertProjectRole.mockResolvedValue(Role.OWNER);
    prismaServiceMock.repository.findUnique.mockResolvedValue(null);
    prismaServiceMock.user.findFirst.mockResolvedValue({ githubToken: 'encrypted-github-token' });
    githubServiceMock.getRepository.mockResolvedValue({
      id: 123,
      name: 'my-app',
      fullName: 'liftoff/my-app',
      private: false,
      defaultBranch: 'main',
      cloneUrl: 'https://github.com/liftoff/my-app.git',
      htmlUrl: 'https://github.com/liftoff/my-app',
    });
    prismaServiceMock.project.findFirst.mockResolvedValue({
      id: 'project-1',
      name: 'my-app',
      environments: [
        {
          id: 'env-1',
          name: 'production',
          gitBranch: 'main',
          liftoffDeploySecret: null,
          configParsed: null,
        },
      ],
    });
    githubServiceMock.createWebhook.mockResolvedValue(555);
    transactionMock.repository.create.mockResolvedValue({
      id: 'repo-1',
      projectId: 'project-1',
      githubId: 123,
      fullName: 'liftoff/my-app',
      cloneUrl: 'https://github.com/liftoff/my-app.git',
      branch: 'main',
      webhookId: 555,
      webhookSecret: 'encrypted-secret',
      createdAt: now,
      updatedAt: now,
    });
    transactionMock.environment.update.mockResolvedValue(undefined);
    githubServiceMock.upsertActionsSecret.mockResolvedValue(undefined);
    githubServiceMock.commitFile.mockRejectedValue({
      response: {
        status: 403,
        data: {
          message: 'Resource not accessible by integration',
        },
      },
    });
    githubServiceMock.deleteWebhook.mockResolvedValue(undefined);
    prismaServiceMock.repository.delete.mockResolvedValue(undefined);

    await expect(
      service.connect('project-1', 'user-1', {
        githubRepoId: 123,
        fullName: 'liftoff/my-app',
        branch: 'main',
      }),
    ).rejects.toThrow('GitHub token is missing workflow/actions permissions');
    expect(githubServiceMock.deleteWebhook).toHaveBeenCalledWith(
      'decrypted-value',
      'liftoff/my-app',
      555,
    );
    expect(prismaServiceMock.repository.delete).toHaveBeenCalledWith({
      where: {
        id: 'repo-1',
      },
    });
  });

  it('connect returns actionable error when Actions secret automation is denied', async () => {
    projectsServiceMock.assertProjectRole.mockResolvedValue(Role.OWNER);
    prismaServiceMock.repository.findUnique.mockResolvedValue(null);
    prismaServiceMock.user.findFirst.mockResolvedValue({ githubToken: 'encrypted-github-token' });
    githubServiceMock.getRepository.mockResolvedValue({
      id: 123,
      name: 'my-app',
      fullName: 'liftoff/my-app',
      private: false,
      defaultBranch: 'main',
      cloneUrl: 'https://github.com/liftoff/my-app.git',
      htmlUrl: 'https://github.com/liftoff/my-app',
    });
    prismaServiceMock.project.findFirst.mockResolvedValue({
      id: 'project-1',
      name: 'my-app',
      environments: [
        {
          id: 'env-1',
          name: 'production',
          gitBranch: 'main',
          liftoffDeploySecret: null,
          configParsed: null,
        },
      ],
    });
    githubServiceMock.createWebhook.mockResolvedValue(555);
    transactionMock.repository.create.mockResolvedValue({
      id: 'repo-1',
      projectId: 'project-1',
      githubId: 123,
      fullName: 'liftoff/my-app',
      cloneUrl: 'https://github.com/liftoff/my-app.git',
      branch: 'main',
      webhookId: 555,
      webhookSecret: 'encrypted-secret',
      createdAt: now,
      updatedAt: now,
    });
    transactionMock.environment.update.mockResolvedValue(undefined);
    githubServiceMock.upsertActionsSecret.mockRejectedValue({
      response: {
        status: 403,
        data: {
          message: 'Resource not accessible by integration',
        },
      },
    });
    githubServiceMock.deleteWebhook.mockResolvedValue(undefined);
    prismaServiceMock.repository.delete.mockResolvedValue(undefined);

    await expect(
      service.connect('project-1', 'user-1', {
        githubRepoId: 123,
        fullName: 'liftoff/my-app',
        branch: 'main',
      }),
    ).rejects.toThrow('GitHub token is missing workflow/actions permissions');

    expect(githubServiceMock.commitFile).not.toHaveBeenCalled();
    expect(githubServiceMock.deleteWebhook).toHaveBeenCalledWith(
      'decrypted-value',
      'liftoff/my-app',
      555,
    );
    expect(prismaServiceMock.repository.delete).toHaveBeenCalledWith({
      where: {
        id: 'repo-1',
      },
    });
  });

  it('connect uses build settings from environment liftoff config', async () => {
    projectsServiceMock.assertProjectRole.mockResolvedValue(Role.OWNER);
    prismaServiceMock.repository.findUnique.mockResolvedValue(null);
    prismaServiceMock.user.findFirst.mockResolvedValue({ githubToken: 'encrypted-github-token' });
    githubServiceMock.getRepository.mockResolvedValue({
      id: 123,
      name: 'my-app',
      fullName: 'liftoff/my-app',
      private: false,
      defaultBranch: 'main',
      cloneUrl: 'https://github.com/liftoff/my-app.git',
      htmlUrl: 'https://github.com/liftoff/my-app',
    });
    prismaServiceMock.project.findFirst.mockResolvedValue({
      id: 'project-1',
      name: 'my-app',
      environments: [
        {
          id: 'env-1',
          name: 'production',
          gitBranch: 'main',
          liftoffDeploySecret: null,
          configParsed: {
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
          },
        },
      ],
    });
    githubServiceMock.createWebhook.mockResolvedValue(555);
    transactionMock.repository.create.mockResolvedValue({
      id: 'repo-1',
      projectId: 'project-1',
      githubId: 123,
      fullName: 'liftoff/my-app',
      cloneUrl: 'https://github.com/liftoff/my-app.git',
      branch: 'main',
      webhookId: 555,
      webhookSecret: 'encrypted-secret',
      createdAt: now,
      updatedAt: now,
    });
    transactionMock.environment.update.mockResolvedValue(undefined);
    githubServiceMock.upsertActionsSecret.mockResolvedValue(undefined);
    githubServiceMock.commitFile.mockResolvedValue(undefined);

    await service.connect('project-1', 'user-1', {
      githubRepoId: 123,
      fullName: 'liftoff/my-app',
      branch: 'main',
    });

    expect(workflowGeneratorServiceMock.generate).toHaveBeenCalledWith(
      expect.objectContaining({
        dockerfilePath: './deploy/Dockerfile',
        dockerBuildContext: './apps/web',
      }),
    );
  });

  it('disconnect removes webhook and repository record', async () => {
    projectsServiceMock.assertProjectRole.mockResolvedValue(Role.ADMIN);
    prismaServiceMock.repository.findUnique.mockResolvedValue({
      id: 'repo-1',
      projectId: 'project-1',
      githubId: 123,
      fullName: 'liftoff/my-app',
      cloneUrl: 'https://github.com/liftoff/my-app.git',
      branch: 'main',
      webhookId: 777,
      webhookSecret: 'encrypted-secret',
      createdAt: now,
      updatedAt: now,
    });
    prismaServiceMock.user.findFirst.mockResolvedValue({ githubToken: 'encrypted-github-token' });
    githubServiceMock.deleteWebhook.mockResolvedValue(undefined);
    prismaServiceMock.repository.delete.mockResolvedValue(undefined);

    await service.disconnect('project-1', 'user-1');

    expect(githubServiceMock.deleteWebhook).toHaveBeenCalledWith(
      'decrypted-value',
      'liftoff/my-app',
      777,
    );
    expect(prismaServiceMock.repository.delete).toHaveBeenCalledWith({
      where: {
        projectId: 'project-1',
      },
    });
  });

  it('listAvailable returns repositories from GitHub API', async () => {
    projectsServiceMock.assertProjectRole.mockResolvedValue(Role.VIEWER);
    prismaServiceMock.user.findFirst.mockResolvedValue({ githubToken: 'encrypted-github-token' });
    githubServiceMock.listRepositories.mockResolvedValue([
      {
        id: 1,
        name: 'repo-one',
        fullName: 'liftoff/repo-one',
        private: false,
        defaultBranch: 'main',
        cloneUrl: 'https://github.com/liftoff/repo-one.git',
        htmlUrl: 'https://github.com/liftoff/repo-one',
      },
    ]);

    const result = await service.listAvailable('project-1', 'user-1');

    expect(result).toHaveLength(1);
    expect(result[0]?.fullName).toBe('liftoff/repo-one');
  });

  it('onModuleInit syncs stale webhook URL to configured WEBHOOK_BASE_URL', async () => {
    prismaServiceMock.repository.findMany.mockResolvedValue([
      {
        id: 'repo-1',
        fullName: 'liftoff/my-app',
        webhookId: 777,
        project: {
          user: {
            githubToken: 'encrypted-github-token',
          },
        },
      },
    ]);
    githubServiceMock.getWebhook.mockResolvedValue({
      id: 777,
      url: 'https://old.example.com/api/v1/webhooks/github',
    });
    githubServiceMock.updateWebhookUrl.mockResolvedValue(undefined);

    await service.onModuleInit();

    expect(githubServiceMock.updateWebhookUrl).toHaveBeenCalledWith(
      'decrypted-value',
      'liftoff/my-app',
      777,
      'https://liftoff.example.com/api/v1/webhooks/github',
    );
  });

  it('onModuleInit marks missing hooks as missing without crashing', async () => {
    prismaServiceMock.repository.findMany.mockResolvedValue([
      {
        id: 'repo-1',
        fullName: 'liftoff/my-app',
        webhookId: 777,
        project: {
          user: {
            githubToken: 'encrypted-github-token',
          },
        },
      },
    ]);
    githubServiceMock.getWebhook.mockRejectedValue({
      response: {
        status: 404,
      },
    });
    prismaServiceMock.repository.update.mockResolvedValue(undefined);

    await expect(service.onModuleInit()).resolves.toBeUndefined();

    expect(prismaServiceMock.repository.update).toHaveBeenCalledWith({
      where: {
        id: 'repo-1',
      },
      data: {
        webhookId: null,
      },
    });
    expect(githubServiceMock.updateWebhookUrl).not.toHaveBeenCalled();
  });
});

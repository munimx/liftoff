import type { User } from '@prisma/client';
import { RepositoriesController } from './repositories.controller';
import { RepositoriesService } from './repositories.service';

const now = new Date('2025-01-01T00:00:00.000Z');

const buildUser = (): User => ({
  id: 'user-1',
  email: 'dev@liftoff.dev',
  githubId: '123',
  githubUsername: 'liftoffdev',
  githubToken: 'encrypted-token',
  name: 'Liftoff Dev',
  avatarUrl: null,
  createdAt: now,
  updatedAt: now,
  deletedAt: null,
});

/**
 * Unit tests for RepositoriesController.
 */
describe('RepositoriesController', () => {
  let controller: RepositoriesController;

  const repositoriesServiceMock = {
    listAvailable: jest.fn(),
    findByProject: jest.fn(),
    connect: jest.fn(),
    disconnect: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    controller = new RepositoriesController(
      repositoriesServiceMock as unknown as RepositoriesService,
    );
  });

  it('findAvailable delegates to service with project and user ids', async () => {
    repositoriesServiceMock.listAvailable.mockResolvedValue([]);

    await controller.findAvailable('project-1', buildUser());

    expect(repositoriesServiceMock.listAvailable).toHaveBeenCalledWith('project-1', 'user-1');
  });

  it('connect delegates DTO and identifiers to service', async () => {
    repositoriesServiceMock.connect.mockResolvedValue({ id: 'repo-1' });

    await controller.connect('project-1', buildUser(), {
      githubRepoId: 1,
      fullName: 'liftoff/repo',
      branch: 'main',
    });

    expect(repositoriesServiceMock.connect).toHaveBeenCalledWith('project-1', 'user-1', {
      githubRepoId: 1,
      fullName: 'liftoff/repo',
      branch: 'main',
    });
  });

  it('disconnect delegates to service', async () => {
    repositoriesServiceMock.disconnect.mockResolvedValue(undefined);

    await controller.disconnect('project-1', buildUser());

    expect(repositoriesServiceMock.disconnect).toHaveBeenCalledWith('project-1', 'user-1');
  });
});

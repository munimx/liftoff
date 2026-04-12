import type { User } from '@prisma/client';
import { ListProjectsQueryDto } from './dto/list-projects-query.dto';
import { ProjectsController } from './projects.controller';
import { ProjectsService } from './projects.service';

const now = new Date('2025-01-01T00:00:00.000Z');

const buildUser = (): User => ({
  id: 'user-1',
  email: 'dev@liftoff.dev',
  githubId: '123',
  githubUsername: 'liftoffdev',
  githubToken: null,
  name: 'Liftoff Dev',
  avatarUrl: null,
  createdAt: now,
  updatedAt: now,
  deletedAt: null,
});

/**
 * Unit tests for ProjectsController.
 */
describe('ProjectsController', () => {
  let controller: ProjectsController;

  const projectsServiceMock = {
    create: jest.fn(),
    findAll: jest.fn(),
    findOne: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    controller = new ProjectsController(projectsServiceMock as unknown as ProjectsService);
  });

  it('findAll delegates pagination and user id to service', async () => {
    const query: ListProjectsQueryDto = {
      page: 2,
      limit: 10,
    };
    projectsServiceMock.findAll.mockResolvedValue({
      data: [],
      total: 0,
    });

    await controller.findAll(buildUser(), query);

    expect(projectsServiceMock.findAll).toHaveBeenCalledWith('user-1', {
      page: 2,
      limit: 10,
    });
  });

  it('delete delegates project id and user id to service', async () => {
    projectsServiceMock.delete.mockResolvedValue(undefined);

    await controller.delete('project-1', buildUser());

    expect(projectsServiceMock.delete).toHaveBeenCalledWith('project-1', 'user-1');
  });
});

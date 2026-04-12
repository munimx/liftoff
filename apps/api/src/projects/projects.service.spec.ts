import { Role } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateProjectDto } from './dto/create-project.dto';
import { ProjectsService } from './projects.service';

const now = new Date('2025-01-01T00:00:00.000Z');

/**
 * Unit tests for ProjectsService.
 */
describe('ProjectsService', () => {
  let service: ProjectsService;

  const prismaServiceMock = {
    project: {
      findMany: jest.fn(),
      count: jest.fn(),
      findFirst: jest.fn(),
      update: jest.fn(),
    },
    environment: {
      updateMany: jest.fn(),
    },
    $transaction: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    service = new ProjectsService(prismaServiceMock as unknown as PrismaService);
  });

  it('create creates project and owner team membership in one transaction', async () => {
    const dto: CreateProjectDto = {
      name: 'my-app',
      description: 'Production app',
    };
    const transactionMock = {
      project: {
        create: jest.fn().mockResolvedValue({
          id: 'project-1',
          userId: 'user-1',
          name: 'my-app',
          description: 'Production app',
          createdAt: now,
          updatedAt: now,
          deletedAt: null,
        }),
      },
      teamMember: {
        create: jest.fn().mockResolvedValue(undefined),
      },
    };
    prismaServiceMock.$transaction.mockImplementation(
      async (callback: (transaction: typeof transactionMock) => Promise<unknown>) =>
        callback(transactionMock),
    );

    const result = await service.create('user-1', dto);

    expect(result.id).toBe('project-1');
    expect(transactionMock.project.create).toHaveBeenCalledWith({
      data: {
        userId: 'user-1',
        name: 'my-app',
        description: 'Production app',
      },
    });
    expect(transactionMock.teamMember.create).toHaveBeenCalledWith({
      data: {
        projectId: 'project-1',
        userId: 'user-1',
        role: Role.OWNER,
      },
    });
  });

  it('assertProjectRole resolves owner role when user owns the project', async () => {
    prismaServiceMock.project.findFirst.mockResolvedValue({
      id: 'project-1',
      userId: 'user-1',
      teamMembers: [],
    });

    const role = await service.assertProjectRole('project-1', 'user-1', [Role.OWNER, Role.ADMIN]);

    expect(role).toBe(Role.OWNER);
  });

  it('assertProjectRole throws when user is not a team member', async () => {
    prismaServiceMock.project.findFirst.mockResolvedValue({
      id: 'project-1',
      userId: 'owner-2',
      teamMembers: [],
    });

    await expect(service.assertProjectRole('project-1', 'user-1')).rejects.toThrow(
      'You do not have access to this project',
    );
  });
});

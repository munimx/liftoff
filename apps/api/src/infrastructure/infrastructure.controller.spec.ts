import type { User } from '@prisma/client';
import { InfrastructureController } from './infrastructure.controller';
import { InfrastructureService } from './infrastructure.service';

/**
 * Unit tests for InfrastructureController.
 */
describe('InfrastructureController', () => {
  let controller: InfrastructureController;

  const infrastructureServiceMock = {
    previewInfra: jest.fn(),
    destroyInfra: jest.fn(),
    getResources: jest.fn(),
  };

  const user: User = {
    id: 'user-1',
    email: 'user@example.com',
    githubId: 'gh-1',
    githubUsername: 'user',
    githubToken: null,
    name: null,
    avatarUrl: null,
    createdAt: new Date('2025-01-01T00:00:00.000Z'),
    updatedAt: new Date('2025-01-01T00:00:00.000Z'),
    deletedAt: null,
  };

  beforeEach(() => {
    jest.clearAllMocks();
    controller = new InfrastructureController(
      infrastructureServiceMock as unknown as InfrastructureService,
    );
  });

  it('previewInfra delegates environment and user ids', async () => {
    infrastructureServiceMock.previewInfra.mockResolvedValue({
      success: true,
      changeSummary: {
        create: 1,
      },
    });

    await controller.previewInfra('env-1', user);

    expect(infrastructureServiceMock.previewInfra).toHaveBeenCalledWith('env-1', 'user-1');
  });

  it('destroyInfra delegates environment and user ids', async () => {
    infrastructureServiceMock.destroyInfra.mockResolvedValue(undefined);

    await controller.destroyInfra('env-1', user);

    expect(infrastructureServiceMock.destroyInfra).toHaveBeenCalledWith('env-1', 'user-1');
  });

  it('getResources delegates environment and user ids', async () => {
    infrastructureServiceMock.getResources.mockResolvedValue([]);

    await controller.getResources('env-1', user);

    expect(infrastructureServiceMock.getResources).toHaveBeenCalledWith('env-1', 'user-1');
  });
});

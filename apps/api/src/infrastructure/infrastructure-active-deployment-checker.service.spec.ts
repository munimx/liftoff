import { DeploymentStatus } from '@prisma/client';
import { EventsGateway } from '../events/events.gateway';
import { PrismaService } from '../prisma/prisma.service';
import { InfrastructureActiveDeploymentCheckerService } from './infrastructure-active-deployment-checker.service';

/**
 * Unit tests for InfrastructureActiveDeploymentCheckerService.
 */
describe('InfrastructureActiveDeploymentCheckerService', () => {
  let service: InfrastructureActiveDeploymentCheckerService;

  const prismaServiceMock = {
    deployment: {
      findMany: jest.fn(),
      update: jest.fn(),
    },
  };

  const eventsGatewayMock = {
    broadcastDeploymentStatus: jest.fn(),
    broadcastDeploymentComplete: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    service = new InfrastructureActiveDeploymentCheckerService(
      prismaServiceMock as unknown as PrismaService,
      eventsGatewayMock as unknown as EventsGateway,
    );
  });

  it('fails active deployments that exceed timeout and notifies websocket clients', async () => {
    prismaServiceMock.deployment.findMany.mockResolvedValue([
      {
        id: 'deployment-1',
        status: DeploymentStatus.PROVISIONING,
      },
    ]);
    prismaServiceMock.deployment.update.mockResolvedValue(undefined);

    await service.failTimedOutActiveDeployments();

    expect(prismaServiceMock.deployment.update).toHaveBeenCalledWith({
      where: {
        id: 'deployment-1',
      },
      data: {
        status: DeploymentStatus.FAILED,
        errorMessage: expect.stringContaining('Deployment timed out after 30 minutes'),
        completedAt: expect.any(Date),
      },
    });
    expect(eventsGatewayMock.broadcastDeploymentStatus).toHaveBeenCalledWith({
      deploymentId: 'deployment-1',
      status: DeploymentStatus.FAILED,
      timestamp: expect.any(String),
    });
    expect(eventsGatewayMock.broadcastDeploymentComplete).toHaveBeenCalledWith({
      deploymentId: 'deployment-1',
      status: DeploymentStatus.FAILED,
    });
  });
});

import { DeploymentStatus } from '@prisma/client';
import { ACTIVE_STATUSES, DeploymentStatusType } from '@liftoff/shared';
import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { EventsGateway } from '../events/events.gateway';
import { PrismaService } from '../prisma/prisma.service';
import { QUEUE_TIMEOUTS } from '../queues/queue.constants';

/**
 * Detects and fails deployments that remain active past the allowed timeout window.
 */
@Injectable()
export class InfrastructureActiveDeploymentCheckerService {
  private readonly logger = new Logger(InfrastructureActiveDeploymentCheckerService.name);

  public constructor(
    private readonly prismaService: PrismaService,
    private readonly eventsGateway: EventsGateway,
  ) {}

  @Cron(CronExpression.EVERY_5_MINUTES)
  public async failTimedOutActiveDeployments(): Promise<void> {
    const cutoff = new Date(Date.now() - QUEUE_TIMEOUTS.ACTIVE_DEPLOYMENT_TIMEOUT_MS);
    const stuckDeployments = await this.prismaService.deployment.findMany({
      where: {
        status: {
          in: ACTIVE_STATUSES as DeploymentStatus[],
        },
        updatedAt: {
          lt: cutoff,
        },
      },
      select: {
        id: true,
        status: true,
      },
    });

    for (const deployment of stuckDeployments) {
      const errorMessage = `Deployment timed out after ${
        QUEUE_TIMEOUTS.ACTIVE_DEPLOYMENT_TIMEOUT_MS / 60000
      } minutes in ${deployment.status} state`;

      await this.prismaService.deployment.update({
        where: {
          id: deployment.id,
        },
        data: {
          status: DeploymentStatus.FAILED,
          errorMessage,
          completedAt: new Date(),
        },
      });

      this.logger.error(`${errorMessage} (deploymentId=${deployment.id})`);
      this.eventsGateway.broadcastDeploymentStatus({
        deploymentId: deployment.id,
        status: DeploymentStatus.FAILED as DeploymentStatusType,
        timestamp: new Date().toISOString(),
      });
      this.eventsGateway.broadcastDeploymentComplete({
        deploymentId: deployment.id,
        status: DeploymentStatus.FAILED as DeploymentStatusType,
      });
    }
  }
}

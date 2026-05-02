import { Module } from '@nestjs/common';
import { EventsModule } from '../events/events.module';
import { ProjectsModule } from '../projects/projects.module';
import { QueuesModule } from '../queues/queues.module';
import { DeploymentsController } from './deployments.controller';
import { DeploymentProcessor } from './deployments.processor';
import { DeploymentsService } from './deployments.service';

/**
 * Deployments module for queue processing and deployment APIs.
 */
@Module({
  imports: [ProjectsModule, QueuesModule, EventsModule],
  controllers: [DeploymentsController],
  providers: [DeploymentsService, DeploymentProcessor],
})
export class DeploymentsModule {}

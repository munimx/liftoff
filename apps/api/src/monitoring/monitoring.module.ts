import { Module } from '@nestjs/common';
import { MonitoringController } from './monitoring.controller';
import { MonitoringService } from './monitoring.service';
import { ProjectsModule } from '../projects/projects.module';
import { DoApiModule } from '../do-api/do-api.module';

/**
 * Monitoring module for logs and metrics.
 */
@Module({
  imports: [ProjectsModule, DoApiModule],
  controllers: [MonitoringController],
  providers: [MonitoringService],
  exports: [MonitoringService],
})
export class MonitoringModule {}

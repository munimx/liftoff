import { Module } from '@nestjs/common';
import { EventsGateway } from './events.gateway';
import { AuthModule } from '../auth/auth.module';
import { MonitoringModule } from '../monitoring/monitoring.module';

/**
 * Realtime events module.
 */
@Module({
  imports: [AuthModule, MonitoringModule],
  providers: [EventsGateway],
  exports: [EventsGateway],
})
export class EventsModule {}

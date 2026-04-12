import { BullModule } from '@nestjs/bullmq';
import { Module } from '@nestjs/common';
import { QUEUE_NAMES } from './queue.constants';

/**
 * Queue registration module.
 */
@Module({
  imports: [
    BullModule.registerQueue(
      { name: QUEUE_NAMES.DEPLOYMENTS },
      { name: QUEUE_NAMES.INFRASTRUCTURE },
    ),
  ],
  exports: [BullModule],
})
export class QueuesModule {}

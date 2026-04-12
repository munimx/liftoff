import { Module } from '@nestjs/common';
import { QueuesModule } from '../queues/queues.module';
import { RepositoriesModule } from '../repositories/repositories.module';
import { WebhooksController } from './webhooks.controller';
import { WebhooksService } from './webhooks.service';

/**
 * Webhook module handling GitHub push and deploy-complete callbacks.
 */
@Module({
  imports: [QueuesModule, RepositoriesModule],
  controllers: [WebhooksController],
  providers: [WebhooksService],
})
export class WebhooksModule {}

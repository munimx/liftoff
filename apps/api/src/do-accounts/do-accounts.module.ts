import { Module } from '@nestjs/common';
import { DOAccountsController } from './do-accounts.controller';
import { DOAccountsService } from './do-accounts.service';

/**
 * DO accounts module with DigitalOcean account lifecycle endpoints.
 */
@Module({
  controllers: [DOAccountsController],
  providers: [DOAccountsService],
  exports: [DOAccountsService],
})
export class DOAccountsModule {}

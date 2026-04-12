import { HttpModule } from '@nestjs/axios';
import { Global, Module } from '@nestjs/common';
import { DoApiService } from './do-api.service';

/**
 * Global module exposing DigitalOcean API integrations.
 */
@Global()
@Module({
  imports: [HttpModule],
  providers: [DoApiService],
  exports: [DoApiService],
})
export class DoApiModule {}

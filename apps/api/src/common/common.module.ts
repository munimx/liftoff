import { Global, Module } from '@nestjs/common';
import { EncryptionService } from './services/encryption.service';

/**
 * Global common services module.
 */
@Global()
@Module({
  providers: [EncryptionService],
  exports: [EncryptionService],
})
export class CommonModule {}

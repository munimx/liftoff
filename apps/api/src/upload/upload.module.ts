import { Module } from '@nestjs/common';
import { DeploymentsModule } from '../deployments/deployments.module';
import { DoApiModule } from '../do-api/do-api.module';
import { EnvironmentsModule } from '../environments/environments.module';
import { ProjectsModule } from '../projects/projects.module';
import { RepositoriesModule } from '../repositories/repositories.module';
import { UploadController } from './upload.controller';
import { UploadService } from './upload.service';

/**
 * Upload module for Simple Mode zip upload and template deployment.
 */
@Module({
  imports: [
    ProjectsModule,
    RepositoriesModule,
    EnvironmentsModule,
    DeploymentsModule,
    DoApiModule,
  ],
  controllers: [UploadController],
  providers: [UploadService],
  exports: [UploadService],
})
export class UploadModule {}

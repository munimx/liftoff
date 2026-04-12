import { Module } from '@nestjs/common';
import { ProjectsModule } from '../projects/projects.module';
import { RepositoriesModule } from '../repositories/repositories.module';
import { EnvironmentsController } from './environments.controller';
import { EnvironmentsService } from './environments.service';

/**
 * Environments module with project-scoped environment CRUD.
 */
@Module({
  imports: [ProjectsModule, RepositoriesModule],
  controllers: [EnvironmentsController],
  providers: [EnvironmentsService],
  exports: [EnvironmentsService],
})
export class EnvironmentsModule {}

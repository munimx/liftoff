import { HttpModule } from '@nestjs/axios';
import { Module } from '@nestjs/common';
import { ProjectsModule } from '../projects/projects.module';
import { GitHubService } from './github.service';
import { RepositoriesController } from './repositories.controller';
import { RepositoriesService } from './repositories.service';
import { WorkflowGeneratorService } from './workflow-generator.service';

/**
 * Repository integration module for GitHub connection management.
 */
@Module({
  imports: [HttpModule, ProjectsModule],
  controllers: [RepositoriesController],
  providers: [GitHubService, WorkflowGeneratorService, RepositoriesService],
  exports: [GitHubService, RepositoriesService],
})
export class RepositoriesModule {}

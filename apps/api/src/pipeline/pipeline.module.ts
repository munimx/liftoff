import { Module } from '@nestjs/common';
import { ProjectsModule } from '../projects/projects.module';
import { PipelineController } from './pipeline.controller';
import { PipelineService } from './pipeline.service';
import { PipelineCompilerService } from './pipeline-compiler.service';

/**
 * Pipeline visual builder module.
 */
@Module({
  imports: [ProjectsModule],
  controllers: [PipelineController],
  providers: [PipelineService, PipelineCompilerService],
  exports: [PipelineService, PipelineCompilerService],
})
export class PipelineModule {}

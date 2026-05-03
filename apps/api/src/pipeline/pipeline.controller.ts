import type { User } from '@prisma/client';
import { Body, Controller, Get, HttpCode, Param, Post, Put, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import type { PipelineNode, PipelineEdge } from '@liftoff/shared';
import { CurrentUser } from '../common/decorators';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { PipelineService } from './pipeline.service';
import { SavePipelineDto } from './dto/save-pipeline.dto';

/**
 * Pipeline graph endpoints for visual pipeline builder.
 */
@Controller('environments/:environmentId/pipeline')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
@ApiTags('Pipeline')
export class PipelineController {
  public constructor(private readonly pipelineService: PipelineService) {}

  /**
   * Loads the pipeline graph for the canvas.
   */
  @Get()
  public getGraph(
    @Param('environmentId') environmentId: string,
    @CurrentUser() user: User,
  ) {
    return this.pipelineService.getGraph(environmentId, user.id);
  }

  /**
   * Saves pipeline graph (auto-validates on save).
   */
  @Put()
  public saveGraph(
    @Param('environmentId') environmentId: string,
    @CurrentUser() user: User,
    @Body() dto: SavePipelineDto,
  ) {
    return this.pipelineService.saveGraph(
      environmentId,
      user.id,
      dto.nodes as unknown as PipelineNode[],
      dto.edges as unknown as PipelineEdge[],
    );
  }

  /**
   * Validates the graph without saving.
   */
  @Post('validate')
  @HttpCode(200)
  public validateGraph(
    @Param('environmentId') environmentId: string,
    @CurrentUser() user: User,
    @Body() dto: SavePipelineDto,
  ) {
    return this.pipelineService.validateGraph(
      environmentId,
      user.id,
      dto.nodes as unknown as PipelineNode[],
      dto.edges as unknown as PipelineEdge[],
    );
  }

  /**
   * Compiles the saved graph to liftoff.yml and returns a preview.
   */
  @Post('compile')
  public compileGraph(
    @Param('environmentId') environmentId: string,
    @CurrentUser() user: User,
  ) {
    return this.pipelineService.compileGraph(environmentId, user.id);
  }

  /**
   * Compiles the graph, writes config to Environment, and triggers deployment.
   */
  @Post('deploy')
  public deployGraph(
    @Param('environmentId') environmentId: string,
    @CurrentUser() user: User,
  ) {
    return this.pipelineService.deployGraph(environmentId, user.id);
  }
}

import type { User } from '@prisma/client';
import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Put,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../common/decorators';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { ConfigYamlDto } from './dto/config-yaml.dto';
import { CreateEnvironmentDto } from './dto/create-environment.dto';
import { UpdateEnvironmentDto } from './dto/update-environment.dto';
import {
  ConfigValidationResponse,
  EnvironmentDetail,
  EnvironmentListItem,
  EnvironmentsService,
} from './environments.service';

/**
 * Project-scoped environment CRUD and config endpoints.
 */
@Controller('projects/:projectId/environments')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
@ApiTags('Environments')
export class EnvironmentsController {
  public constructor(private readonly environmentsService: EnvironmentsService) {}

  /**
   * Creates an environment under a project.
   */
  @Post()
  public create(
    @Param('projectId') projectId: string,
    @CurrentUser() user: User,
    @Body() dto: CreateEnvironmentDto,
  ) {
    return this.environmentsService.create(projectId, user.id, dto);
  }

  /**
   * Lists environments for a project.
   */
  @Get()
  public findAll(
    @Param('projectId') projectId: string,
    @CurrentUser() user: User,
  ): Promise<EnvironmentListItem[]> {
    return this.environmentsService.findAll(projectId, user.id);
  }

  /**
   * Returns one environment by ID.
   */
  @Get(':id')
  public findOne(
    @Param('projectId') projectId: string,
    @Param('id') id: string,
    @CurrentUser() user: User,
  ): Promise<EnvironmentDetail> {
    return this.environmentsService.findOne(projectId, id, user.id);
  }

  /**
   * Updates mutable environment fields.
   */
  @Patch(':id')
  public update(
    @Param('projectId') projectId: string,
    @Param('id') id: string,
    @CurrentUser() user: User,
    @Body() dto: UpdateEnvironmentDto,
  ) {
    return this.environmentsService.update(projectId, id, user.id, dto);
  }

  /**
   * Soft-deletes an environment.
   */
  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  public async delete(
    @Param('projectId') projectId: string,
    @Param('id') id: string,
    @CurrentUser() user: User,
  ): Promise<void> {
    await this.environmentsService.delete(projectId, id, user.id);
  }

  /**
   * Validates and persists environment liftoff.yml.
   */
  @Put(':id/config')
  public updateConfig(
    @Param('projectId') projectId: string,
    @Param('id') id: string,
    @CurrentUser() user: User,
    @Body() dto: ConfigYamlDto,
  ) {
    return this.environmentsService.updateConfig(projectId, id, user.id, dto.configYaml);
  }

  /**
   * Validates environment liftoff.yml without writing to the database.
   */
  @Post(':id/config/validate')
  public validateConfig(
    @Param('projectId') projectId: string,
    @Param('id') id: string,
    @CurrentUser() user: User,
    @Body() dto: ConfigYamlDto,
  ): Promise<ConfigValidationResponse> {
    return this.environmentsService.validateConfig(projectId, id, user.id, dto);
  }
}

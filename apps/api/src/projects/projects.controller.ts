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
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { PaginationQuery } from '@liftoff/shared';
import { CurrentUser } from '../common/decorators';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { CreateProjectDto } from './dto/create-project.dto';
import { ListProjectsQueryDto } from './dto/list-projects-query.dto';
import { UpdateProjectDto } from './dto/update-project.dto';
import { ProjectDetail, ProjectsListResponse, ProjectsService } from './projects.service';

/**
 * Project CRUD endpoints.
 */
@Controller('projects')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
@ApiTags('Projects')
export class ProjectsController {
  public constructor(private readonly projectsService: ProjectsService) {}

  /**
   * Creates a new project for the authenticated user.
   */
  @Post()
  public create(@CurrentUser() user: User, @Body() dto: CreateProjectDto) {
    return this.projectsService.create(user.id, dto);
  }

  /**
   * Lists projects with pagination.
   */
  @Get()
  public findAll(
    @CurrentUser() user: User,
    @Query() query: ListProjectsQueryDto,
  ): Promise<ProjectsListResponse> {
    const paginationQuery: PaginationQuery = {
      page: query.page,
      limit: query.limit,
    };

    return this.projectsService.findAll(user.id, paginationQuery);
  }

  /**
   * Returns one project by ID if the user is a member.
   */
  @Get(':id')
  public findOne(@Param('id') id: string, @CurrentUser() user: User): Promise<ProjectDetail> {
    return this.projectsService.findOne(id, user.id);
  }

  /**
   * Updates a project by ID.
   */
  @Patch(':id')
  public update(
    @Param('id') id: string,
    @CurrentUser() user: User,
    @Body() dto: UpdateProjectDto,
  ) {
    return this.projectsService.update(id, user.id, dto);
  }

  /**
   * Soft-deletes a project by ID.
   */
  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  public async delete(@Param('id') id: string, @CurrentUser() user: User): Promise<void> {
    await this.projectsService.delete(id, user.id);
  }
}

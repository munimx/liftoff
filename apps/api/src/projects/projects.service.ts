import { Prisma, Project, Role } from '@prisma/client';
import {
  ErrorCodes,
  PaginationQuery,
  PaginationQuerySchema,
  paginate,
} from '@liftoff/shared';
import { Injectable } from '@nestjs/common';
import { Exceptions } from '../common/exceptions/app.exception';
import { PrismaService } from '../prisma/prisma.service';
import { CreateProjectDto } from './dto/create-project.dto';
import { UpdateProjectDto } from './dto/update-project.dto';

type ProjectMembershipContext = {
  userId: string;
  teamMembers: Array<{
    role: Role;
  }>;
};

export type ProjectListItem = Prisma.ProjectGetPayload<{
  include: {
    _count: {
      select: {
        environments: true;
      };
    };
  };
}>;

export type ProjectDetail = Prisma.ProjectGetPayload<{
  include: {
    environments: true;
    teamMembers: {
      include: {
        user: {
          select: {
            id: true;
            email: true;
            githubUsername: true;
            name: true;
            avatarUrl: true;
            createdAt: true;
          };
        };
      };
    };
  };
}>;

export interface ProjectsListResponse {
  data: ProjectListItem[];
  total: number;
}

/**
 * Handles project CRUD operations and project-level RBAC checks.
 */
@Injectable()
export class ProjectsService {
  public constructor(private readonly prismaService: PrismaService) {}

  /**
   * Creates a project and auto-assigns the creator as OWNER team member.
   */
  public async create(userId: string, dto: CreateProjectDto): Promise<Project> {
    try {
      return await this.prismaService.$transaction(async (transaction) => {
        const project = await transaction.project.create({
          data: {
            userId,
            name: dto.name,
            description: dto.description ?? null,
          },
        });

        await transaction.teamMember.create({
          data: {
            projectId: project.id,
            userId,
            role: Role.OWNER,
          },
        });

        return project;
      });
    } catch (error) {
      if (this.isUniqueConstraintError(error)) {
        throw Exceptions.conflict('Project name is already taken', ErrorCodes.PROJECT_NAME_TAKEN);
      }
      throw error;
    }
  }

  /**
   * Lists non-deleted projects for the owner with pagination and environment counts.
   */
  public async findAll(userId: string, query: PaginationQuery): Promise<ProjectsListResponse> {
    const normalizedQuery = PaginationQuerySchema.parse(query);
    const { skip, take } = paginate(normalizedQuery);

    const [data, total] = await this.prismaService.$transaction([
      this.prismaService.project.findMany({
        where: {
          userId,
          deletedAt: null,
        },
        orderBy: {
          createdAt: 'desc',
        },
        skip,
        take,
        include: {
          _count: {
            select: {
              environments: {
                where: {
                  deletedAt: null,
                },
              },
            },
          },
        },
      }),
      this.prismaService.project.count({
        where: {
          userId,
          deletedAt: null,
        },
      }),
    ]);

    return {
      data,
      total,
    };
  }

  /**
   * Returns one project with active environments and team membership details.
   */
  public async findOne(id: string, userId: string): Promise<ProjectDetail> {
    const project = await this.prismaService.project.findFirst({
      where: {
        id,
        deletedAt: null,
      },
      include: {
        environments: {
          where: {
            deletedAt: null,
          },
          orderBy: {
            createdAt: 'desc',
          },
        },
        teamMembers: {
          include: {
            user: {
              select: {
                id: true,
                email: true,
                githubUsername: true,
                name: true,
                avatarUrl: true,
                createdAt: true,
              },
            },
          },
          orderBy: {
            createdAt: 'asc',
          },
        },
      },
    });

    if (!project) {
      throw Exceptions.notFound('Project not found', ErrorCodes.PROJECT_NOT_FOUND);
    }

    const role = this.resolveProjectRole(project, userId);
    if (!role) {
      throw Exceptions.forbidden('You do not have access to this project', ErrorCodes.PROJECT_FORBIDDEN);
    }

    return project;
  }

  /**
   * Updates editable project fields for OWNER/ADMIN users.
   */
  public async update(id: string, userId: string, dto: UpdateProjectDto): Promise<Project> {
    await this.assertProjectRole(id, userId, [Role.OWNER, Role.ADMIN]);

    try {
      return await this.prismaService.project.update({
        where: {
          id,
        },
        data: {
          name: dto.name,
          description: dto.description,
        },
      });
    } catch (error) {
      if (this.isUniqueConstraintError(error)) {
        throw Exceptions.conflict('Project name is already taken', ErrorCodes.PROJECT_NAME_TAKEN);
      }
      throw error;
    }
  }

  /**
   * Soft-deletes a project (and its active environments) for OWNER users.
   */
  public async delete(id: string, userId: string): Promise<void> {
    await this.assertProjectRole(id, userId, [Role.OWNER]);

    const deletedAt = new Date();
    await this.prismaService.$transaction([
      this.prismaService.project.update({
        where: {
          id,
        },
        data: {
          deletedAt,
        },
      }),
      this.prismaService.environment.updateMany({
        where: {
          projectId: id,
          deletedAt: null,
        },
        data: {
          deletedAt,
        },
      }),
    ]);
  }

  /**
   * Ensures the user has a required role on a project and returns the resolved role.
   */
  public async assertProjectRole(
    projectId: string,
    userId: string,
    allowedRoles?: Role[],
  ): Promise<Role> {
    const project = await this.prismaService.project.findFirst({
      where: {
        id: projectId,
        deletedAt: null,
      },
      select: {
        id: true,
        userId: true,
        teamMembers: {
          where: {
            userId,
          },
          select: {
            role: true,
          },
        },
      },
    });

    if (!project) {
      throw Exceptions.notFound('Project not found', ErrorCodes.PROJECT_NOT_FOUND);
    }

    const role = this.resolveProjectRole(project, userId);
    if (!role) {
      throw Exceptions.forbidden('You do not have access to this project', ErrorCodes.PROJECT_FORBIDDEN);
    }

    if (allowedRoles && !allowedRoles.includes(role)) {
      throw Exceptions.forbidden(
        'You do not have permission to modify this project',
        ErrorCodes.PROJECT_FORBIDDEN,
      );
    }

    return role;
  }

  private resolveProjectRole(project: ProjectMembershipContext, userId: string): Role | null {
    if (project.userId === userId) {
      return Role.OWNER;
    }

    return project.teamMembers[0]?.role ?? null;
  }

  private isUniqueConstraintError(error: unknown): error is Prisma.PrismaClientKnownRequestError {
    return error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002';
  }
}

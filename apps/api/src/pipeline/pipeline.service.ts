import { Injectable } from '@nestjs/common';
import { Prisma, Role } from '@prisma/client';
import { ErrorCodes } from '@liftoff/shared';
import type { PipelineNode, PipelineEdge, PipelineValidationError } from '@liftoff/shared';
import { PrismaService } from '../prisma/prisma.service';
import { ProjectsService } from '../projects/projects.service';
import { Exceptions } from '../common/exceptions/app.exception';
import { PipelineCompilerService } from './pipeline-compiler.service';

/**
 * Manages pipeline graph CRUD and validation.
 */
@Injectable()
export class PipelineService {
  public constructor(
    private readonly prisma: PrismaService,
    private readonly projectsService: ProjectsService,
    private readonly compiler: PipelineCompilerService,
  ) {}

  /**
   * Loads the pipeline graph for an environment, creating a blank one if none exists.
   */
  public async getGraph(environmentId: string, userId: string) {
    const env = await this.getEnvironmentContext(environmentId);
    await this.projectsService.assertProjectRole(env.projectId, userId);

    const graph = await this.prisma.pipelineGraph.findUnique({
      where: { environmentId },
    });

    if (!graph) {
      return this.prisma.pipelineGraph.create({
        data: {
          environmentId,
          nodes: [] as Prisma.InputJsonValue,
          edges: [] as Prisma.InputJsonValue,
          isValid: true,
        },
      });
    }

    return graph;
  }

  /**
   * Saves graph nodes and edges, runs validation, and persists results.
   */
  public async saveGraph(
    environmentId: string,
    userId: string,
    nodes: PipelineNode[],
    edges: PipelineEdge[],
  ) {
    const env = await this.getEnvironmentContext(environmentId);
    await this.projectsService.assertProjectRole(env.projectId, userId, [Role.OWNER, Role.ADMIN]);

    const validationErrors = this.compiler.validate(nodes, edges);
    const isValid = validationErrors.length === 0;

    let compiledYaml: string | null = null;
    if (isValid) {
      try {
        const result = this.compiler.compile(nodes, edges);
        compiledYaml = result.yaml;
      } catch {
        // Compilation failed — save graph without compiled output
      }
    }

    const nodesJson = JSON.parse(JSON.stringify(nodes)) as Prisma.InputJsonValue;
    const edgesJson = JSON.parse(JSON.stringify(edges)) as Prisma.InputJsonValue;
    const errorsJson = validationErrors.length > 0
      ? (JSON.parse(JSON.stringify(validationErrors)) as Prisma.InputJsonValue)
      : Prisma.JsonNull;

    return this.prisma.pipelineGraph.upsert({
      where: { environmentId },
      create: {
        environmentId,
        nodes: nodesJson,
        edges: edgesJson,
        compiledYaml,
        isValid,
        validationErrors: errorsJson,
      },
      update: {
        nodes: nodesJson,
        edges: edgesJson,
        compiledYaml,
        isValid,
        validationErrors: errorsJson,
      },
    });
  }

  /**
   * Validates nodes and edges without saving.
   */
  public async validateGraph(
    environmentId: string,
    userId: string,
    nodes: PipelineNode[],
    edges: PipelineEdge[],
  ): Promise<{ isValid: boolean; validationErrors: PipelineValidationError[] }> {
    const env = await this.getEnvironmentContext(environmentId);
    await this.projectsService.assertProjectRole(env.projectId, userId);

    const validationErrors = this.compiler.validate(nodes, edges);
    return { isValid: validationErrors.length === 0, validationErrors };
  }

  /**
   * Compiles the graph into a LiftoffConfig YAML and returns a preview.
   */
  public async compileGraph(environmentId: string, userId: string) {
    const env = await this.getEnvironmentContext(environmentId);
    await this.projectsService.assertProjectRole(env.projectId, userId);

    const graph = await this.prisma.pipelineGraph.findUnique({
      where: { environmentId },
    });

    if (!graph) {
      throw Exceptions.notFound('Pipeline graph not found', ErrorCodes.PIPELINE_NOT_FOUND);
    }

    const nodes = graph.nodes as unknown as PipelineNode[];
    const edges = graph.edges as unknown as PipelineEdge[];

    const validationErrors = this.compiler.validate(nodes, edges);
    if (validationErrors.length > 0) {
      throw Exceptions.badRequest(
        'Pipeline graph has validation errors',
        ErrorCodes.PIPELINE_INVALID_GRAPH,
      );
    }

    const result = this.compiler.compile(nodes, edges);

    await this.prisma.pipelineGraph.update({
      where: { environmentId },
      data: {
        compiledYaml: result.yaml,
        isValid: true,
        validationErrors: Prisma.JsonNull,
      },
    });

    return result;
  }

  /**
   * Compiles the graph and writes configYaml to the Environment, then triggers a deployment.
   */
  public async deployGraph(environmentId: string, userId: string) {
    const env = await this.getEnvironmentContext(environmentId);
    await this.projectsService.assertProjectRole(env.projectId, userId, [Role.OWNER, Role.ADMIN]);

    const result = await this.compileGraph(environmentId, userId);

    const configParsed = JSON.parse(JSON.stringify(result.config)) as Prisma.InputJsonValue;

    await this.prisma.environment.update({
      where: { id: environmentId },
      data: {
        configYaml: result.yaml,
        configParsed,
      },
    });

    return result;
  }

  private async getEnvironmentContext(environmentId: string) {
    const environment = await this.prisma.environment.findFirst({
      where: { id: environmentId, deletedAt: null },
      select: { id: true, projectId: true },
    });

    if (!environment) {
      throw Exceptions.notFound('Environment not found', ErrorCodes.ENVIRONMENT_NOT_FOUND);
    }

    return environment;
  }
}

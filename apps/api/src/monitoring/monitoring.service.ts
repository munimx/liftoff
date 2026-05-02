import { Injectable, Logger } from '@nestjs/common';
import { Exceptions } from '../common/exceptions/app.exception';
import { EncryptionService } from '../common/services/encryption.service';
import { DoApiService } from '../do-api/do-api.service';
import { PrismaService } from '../prisma/prisma.service';
import { ProjectsService } from '../projects/projects.service';
import { ErrorCodes } from '@liftoff/shared';
import { Socket } from 'socket.io';

export interface AppLogEntry {
  line: string;
  timestamp: string;
  level: 'DEBUG' | 'INFO' | 'WARN' | 'ERROR';
  source: string;
}

export interface MetricDatapoint {
  timestamp: number;
  value: number;
}

/**
 * Monitoring service for retrieving app logs and metrics from DigitalOcean.
 */
@Injectable()
export class MonitoringService {
  private readonly logger = new Logger(MonitoringService.name);

  public constructor(
    private readonly prismaService: PrismaService,
    private readonly projectsService: ProjectsService,
    private readonly doApiService: DoApiService,
    private readonly encryptionService: EncryptionService,
  ) {}

  /**
   * Fetches application runtime logs from DigitalOcean App Platform.
   */
  public async getLogs(
    environmentId: string,
    userId: string,
    logType: 'BUILD' | 'DEPLOY' | 'RUN' | 'RUN_RESTARTED' = 'RUN',
    limit: number = 200,
  ): Promise<AppLogEntry[]> {
    const environment = await this.getEnvironmentWithAccess(environmentId, userId);
    const appContext = await this.getAppContext(environment);

    if (!appContext) {
      throw Exceptions.badRequest('App Platform outputs are missing', ErrorCodes.DEPLOYMENT_NO_INFRA);
    }

    const doToken = this.decryptDoToken(environment.doAccount.doToken);
    const rawLogs = await this.doApiService.getAppRuntimeLogs(doToken, appContext.appId, logType, environment.doAccountId);

    const entries: AppLogEntry[] = rawLogs.slice(-limit).map((line, index) => ({
      line,
      timestamp: new Date(Date.now() - (rawLogs.length - index - 1) * 1000).toISOString(),
      level: this.detectLogLevel(line),
      source: 'do-app-platform',
    }));

    return entries;
  }

  /**
   * Fetches application metrics from DigitalOcean monitoring API.
   */
  public async getMetrics(
    environmentId: string,
    userId: string,
    metricType: 'cpu' | 'memory' | 'bandwidth',
  ): Promise<MetricDatapoint[]> {
    const environment = await this.getEnvironmentWithAccess(environmentId, userId);
    const appContext = await this.getAppContext(environment);

    if (!appContext) {
      throw Exceptions.badRequest('App Platform outputs are missing', ErrorCodes.DEPLOYMENT_NO_INFRA);
    }

    const doToken = this.decryptDoToken(environment.doAccount.doToken);
    const doMetricType = this.mapMetricType(metricType);

    return this.doApiService.getAppMetrics(doToken, appContext.appId, doMetricType, environment.doAccountId);
  }

  /**
   * Streams live application logs to a WebSocket client.
   */
  public async streamLogs(environmentId: string, userId: string, socket: Socket): Promise<void> {
    const environment = await this.getEnvironmentWithAccess(environmentId, userId);
    const appContext = await this.getAppContext(environment);

    if (!appContext) {
      socket.emit('error', { message: 'App Platform outputs are missing' });
      return;
    }

    const doToken = this.decryptDoToken(environment.doAccount.doToken);
    const logGenerator = this.doApiService.getLiveAppLogs(
      doToken,
      appContext.appId,
      'RUN',
      5000,
      environment.doAccountId,
    );

    socket.on('disconnect', () => {
      logGenerator.return(undefined).catch(() => {
        // Generator closed
      });
    });

    try {
      for await (const line of logGenerator) {
        if (!socket.connected) {
          break;
        }

        socket.emit('log-line', {
          line,
          timestamp: new Date().toISOString(),
          level: this.detectLogLevel(line),
          source: 'do-app-platform',
        });
      }
    } catch (error) {
      this.logger.warn(`Log streaming error: ${error instanceof Error ? error.message : 'Unknown error'}`);
      socket.emit('error', { message: 'Failed to stream logs' });
    }
  }

  private async getEnvironmentWithAccess(
    environmentId: string,
    userId: string,
  ): Promise<{
    id: string;
    projectId: string;
    doAccountId: string;
    doAccount: { doToken: string };
    pulumiStack: { outputs: unknown } | null;
  }> {
    const environment = await this.prismaService.environment.findFirst({
      where: {
        id: environmentId,
        deletedAt: null,
      },
      select: {
        id: true,
        projectId: true,
        doAccountId: true,
        doAccount: {
          select: {
            doToken: true,
          },
        },
        pulumiStack: {
          select: {
            outputs: true,
          },
        },
      },
    });

    if (!environment) {
      throw Exceptions.notFound('Environment not found', ErrorCodes.ENVIRONMENT_NOT_FOUND);
    }

    await this.projectsService.assertProjectRole(environment.projectId, userId);

    return environment;
  }

  private async getAppContext(
    environment: { pulumiStack: { outputs: unknown } | null },
  ): Promise<{ appId: string; appUrl: string } | null> {
    if (!environment.pulumiStack?.outputs || typeof environment.pulumiStack.outputs !== 'object') {
      return null;
    }

    const outputs = environment.pulumiStack.outputs as Record<string, unknown>;
    const appId = this.resolveOutputValue(outputs.appId);
    const appUrl = this.resolveOutputValue(outputs.appUrl);

    if (!appId || !appUrl) {
      return null;
    }

    return { appId, appUrl };
  }

  private resolveOutputValue(value: unknown): string | null {
    if (typeof value === 'string') {
      return value;
    }

    if (typeof value === 'number' || typeof value === 'boolean') {
      return String(value);
    }

    if (value && typeof value === 'object' && !Array.isArray(value) && 'value' in value) {
      const nestedValue = (value as { value?: unknown }).value;
      if (typeof nestedValue === 'string') {
        return nestedValue;
      }
      if (typeof nestedValue === 'number' || typeof nestedValue === 'boolean') {
        return String(nestedValue);
      }
    }

    return null;
  }

  private decryptDoToken(encryptedToken: string): string {
    try {
      return this.encryptionService.decrypt(encryptedToken);
    } catch {
      throw Exceptions.internalError(
        'Stored DigitalOcean token cannot be decrypted',
        ErrorCodes.DO_ACCOUNT_VALIDATION_FAILED,
      );
    }
  }

  private mapMetricType(type: 'cpu' | 'memory' | 'bandwidth'): 'cpu_percentage' | 'memory_percentage' | 'network_bandwidth' {
    switch (type) {
      case 'cpu':
        return 'cpu_percentage';
      case 'memory':
        return 'memory_percentage';
      case 'bandwidth':
        return 'network_bandwidth';
    }
  }

  private detectLogLevel(line: string): 'DEBUG' | 'INFO' | 'WARN' | 'ERROR' {
    const upperLine = line.toUpperCase();
    if (upperLine.includes('[ERROR]') || upperLine.includes('ERROR')) {
      return 'ERROR';
    }
    if (upperLine.includes('[WARN]') || upperLine.includes('WARNING')) {
      return 'WARN';
    }
    if (upperLine.includes('[DEBUG]')) {
      return 'DEBUG';
    }
    return 'INFO';
  }
}

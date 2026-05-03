import { Controller, Get, VERSION_NEUTRAL, Version } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Public } from './common/decorators';
import { PrismaService } from './prisma/prisma.service';
import Redis from 'ioredis';

interface DetailedHealthResponse {
  status: 'ok' | 'degraded';
  database: 'ok' | 'error';
  redis: 'ok' | 'error';
  timestamp: string;
}

/**
 * Application root controller.
 */
@Controller()
export class AppController {
  private readonly redisUrl: string;

  public constructor(
    private readonly prismaService: PrismaService,
    private readonly configService: ConfigService,
  ) {
    this.redisUrl = this.configService.getOrThrow<string>('REDIS_URL');
  }

  /**
   * Returns an API health payload for readiness checks.
   */
  @Public()
  @Version(VERSION_NEUTRAL)
  @Get('health')
  public getHealth(): { status: 'ok'; timestamp: string } {
    return {
      status: 'ok',
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * Returns a detailed health payload with DB and Redis connectivity checks.
   */
  @Public()
  @Version(VERSION_NEUTRAL)
  @Get('health/detailed')
  public async getDetailedHealth(): Promise<DetailedHealthResponse> {
    let database: 'ok' | 'error' = 'error';
    let redis: 'ok' | 'error' = 'error';

    try {
      await this.prismaService.$queryRaw`SELECT 1`;
      database = 'ok';
    } catch {}

    let redisClient: Redis | null = null;
    try {
      redisClient = new Redis(this.redisUrl, { connectTimeout: 3000, lazyConnect: true });
      await redisClient.connect();
      await redisClient.ping();
      redis = 'ok';
    } catch {
    } finally {
      if (redisClient) {
        redisClient.disconnect();
      }
    }

    const status = database === 'ok' && redis === 'ok' ? 'ok' : 'degraded';

    return {
      status,
      database,
      redis,
      timestamp: new Date().toISOString(),
    };
  }
}

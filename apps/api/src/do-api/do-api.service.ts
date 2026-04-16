import { HttpService } from '@nestjs/axios';
import { Injectable } from '@nestjs/common';
import { randomBytes } from 'crypto';
import { firstValueFrom } from 'rxjs';
import { PrismaService } from '../prisma/prisma.service';

interface DigitalOceanAccountResponse {
  account: {
    email: string;
    uuid: string;
    status: string;
  };
}

interface DigitalOceanDeploymentResponse {
  deployment: {
    phase: string;
  };
}

interface DigitalOceanRegistryResponse {
  registry: {
    name: string;
  };
}

type ErrorWithResponseStatus = {
  response?: {
    status?: unknown;
  };
};

/**
 * DigitalOcean API client wrapper for common platform operations.
 */
@Injectable()
export class DoApiService {
  private static readonly BASE_URL = 'https://api.digitalocean.com';
  private static readonly REGISTRY_CREATE_ATTEMPTS = 5;
  private static readonly REGISTRY_SUBSCRIPTION_TIER = 'starter';

  public constructor(
    private readonly httpService: HttpService,
    private readonly prismaService: PrismaService,
  ) {}

  /**
   * Validates a user or platform DigitalOcean token against /v2/account.
   */
  public async validateToken(
    doToken: string,
    doAccountId?: string,
  ): Promise<{ email: string; uuid: string; status: string }> {
    const { data } = await this.executeRequest(
      firstValueFrom(
        this.httpService.get<DigitalOceanAccountResponse>(`${DoApiService.BASE_URL}/v2/account`, {
          headers: this.getHeaders(doToken),
        }),
      ),
      doAccountId,
    );

    return {
      email: data.account.email,
      uuid: data.account.uuid,
      status: data.account.status,
    };
  }

  /**
   * Fetches App Platform deployment status.
   */
  public async getAppDeploymentStatus(
    doToken: string,
    appId: string,
    deploymentId: string,
    doAccountId?: string,
  ): Promise<string> {
    const { data } = await this.executeRequest(
      firstValueFrom(
        this.httpService.get<DigitalOceanDeploymentResponse>(
          `${DoApiService.BASE_URL}/v2/apps/${appId}/deployments/${deploymentId}`,
          {
            headers: this.getHeaders(doToken),
          },
        ),
      ),
      doAccountId,
    );

    return data.deployment.phase;
  }

  /**
   * Fetches raw App Platform deployment logs as serialized text.
   */
  public async getAppLogs(
    doToken: string,
    appId: string,
    deploymentId: string,
    doAccountId?: string,
  ): Promise<string> {
    const { data } = await this.executeRequest(
      firstValueFrom(
        this.httpService.get<unknown>(
          `${DoApiService.BASE_URL}/v2/apps/${appId}/deployments/${deploymentId}/logs`,
          {
            headers: this.getHeaders(doToken),
          },
        ),
      ),
      doAccountId,
    );

    return typeof data === 'string' ? data : JSON.stringify(data);
  }

  /**
   * Returns the user's container registry name, creating one on demand when missing.
   */
  public async getOrCreateContainerRegistryName(
    doToken: string,
    doAccountId?: string,
  ): Promise<string> {
    try {
      const { data } = await this.executeRequest(
        firstValueFrom(
          this.httpService.get<DigitalOceanRegistryResponse>(
            `${DoApiService.BASE_URL}/v2/registry`,
            {
              headers: this.getHeaders(doToken),
            },
          ),
        ),
        doAccountId,
      );

      return data.registry.name;
    } catch (error) {
      if (this.resolveStatus(error) !== 404) {
        throw error;
      }
    }

    return this.createContainerRegistry(doToken, doAccountId);
  }

  private async executeRequest<T>(request: Promise<T>, doAccountId?: string): Promise<T> {
    try {
      return await request;
    } catch (error) {
      if (doAccountId && this.resolveStatus(error) === 401) {
        await this.invalidateAccount(doAccountId);
      }

      throw error;
    }
  }

  private async invalidateAccount(doAccountId: string): Promise<void> {
    await this.prismaService.dOAccount.updateMany({
      where: {
        id: doAccountId,
      },
      data: {
        validatedAt: null,
      },
    });
  }

  private async createContainerRegistry(doToken: string, doAccountId?: string): Promise<string> {
    for (let attempt = 1; attempt <= DoApiService.REGISTRY_CREATE_ATTEMPTS; attempt += 1) {
      const candidateName = this.generateRegistryName();

      try {
        const { data } = await this.executeRequest(
          firstValueFrom(
            this.httpService.post<DigitalOceanRegistryResponse>(
              `${DoApiService.BASE_URL}/v2/registry`,
              {
                name: candidateName,
                subscription_tier_slug: DoApiService.REGISTRY_SUBSCRIPTION_TIER,
              },
              {
                headers: this.getHeaders(doToken),
              },
            ),
          ),
          doAccountId,
        );

        return data.registry.name;
      } catch (error) {
        const statusCode = this.resolveStatus(error);
        const isLastAttempt = attempt === DoApiService.REGISTRY_CREATE_ATTEMPTS;

        if (statusCode === 422 && !isLastAttempt) {
          continue;
        }

        throw error;
      }
    }

    throw new Error('Failed to create a container registry');
  }

  private generateRegistryName(): string {
    return `liftoff-${randomBytes(5).toString('hex')}`;
  }

  private resolveStatus(error: unknown): number | null {
    if (!error || typeof error !== 'object') {
      return null;
    }

    const maybeError = error as ErrorWithResponseStatus;
    const status = maybeError.response?.status;
    return typeof status === 'number' ? status : null;
  }

  private getHeaders(doToken: string): Record<string, string> {
    return {
      Authorization: `Bearer ${doToken}`,
    };
  }
}

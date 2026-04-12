import { HttpService } from '@nestjs/axios';
import { Injectable } from '@nestjs/common';
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

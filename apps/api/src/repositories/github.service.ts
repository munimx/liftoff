import { HttpService } from '@nestjs/axios';
import { Injectable } from '@nestjs/common';
import { createHmac, timingSafeEqual } from 'crypto';
import type { AxiosRequestConfig, AxiosResponse } from 'axios';
import sodium from 'libsodium-wrappers';
import { firstValueFrom } from 'rxjs';

interface GitHubRepositoryApiResponse {
  id: number;
  name: string;
  full_name: string;
  private: boolean;
  default_branch: string;
  clone_url: string;
  html_url: string;
}

interface GitHubContentApiResponse {
  sha: string;
}

interface GitHubWebhookApiResponse {
  id: number;
  config: {
    url?: string;
  };
}

interface GitHubActionsPublicKeyApiResponse {
  key: string;
  key_id: string;
}

/**
 * Minimal GitHub repository data used by Liftoff.
 */
export interface GitHubRepo {
  id: number;
  name: string;
  fullName: string;
  private: boolean;
  defaultBranch: string;
  cloneUrl: string;
  htmlUrl: string;
}

/**
 * Minimal GitHub webhook data used by Liftoff.
 */
export interface GitHubWebhook {
  id: number;
  url: string;
}

/**
 * GitHub REST API wrapper for repository and webhook operations.
 */
@Injectable()
export class GitHubService {
  private static readonly BASE_URL = 'https://api.github.com';
  private static readonly API_VERSION = '2022-11-28';
  private static readonly USER_AGENT = 'liftoff';
  private static sodiumReadyPromise: Promise<void> | null = null;

  public constructor(private readonly httpService: HttpService) {}

  /**
   * Lists repositories available to the authenticated GitHub user.
   */
  public async listRepositories(githubToken: string): Promise<GitHubRepo[]> {
    const { data } = await this.request<GitHubRepositoryApiResponse[]>(
      {
        method: 'GET',
        url: '/user/repos',
        params: {
          sort: 'updated',
          per_page: 100,
          type: 'all',
        },
      },
      githubToken,
    );

    return data.map((repository) => this.mapRepository(repository));
  }

  /**
   * Returns one repository by its owner/name path.
   */
  public async getRepository(githubToken: string, fullName: string): Promise<GitHubRepo> {
    const { data } = await this.request<GitHubRepositoryApiResponse>(
      {
        method: 'GET',
        url: `/repos/${fullName}`,
      },
      githubToken,
    );

    return this.mapRepository(data);
  }

  /**
   * Creates a GitHub webhook and returns the created hook id.
   */
  public async createWebhook(
    githubToken: string,
    fullName: string,
    webhookUrl: string,
    secret: string,
  ): Promise<number> {
    const { data } = await this.request<{ id: number }>(
      {
        method: 'POST',
        url: `/repos/${fullName}/hooks`,
        data: {
          name: 'web',
          active: true,
          events: ['push', 'pull_request'],
          config: {
            url: webhookUrl,
            content_type: 'json',
            secret,
          },
        },
      },
      githubToken,
    );

    return data.id;
  }

  /**
   * Deletes a GitHub webhook by hook id.
   */
  public async deleteWebhook(githubToken: string, fullName: string, hookId: number): Promise<void> {
    await this.request(
      {
        method: 'DELETE',
        url: `/repos/${fullName}/hooks/${hookId}`,
      },
      githubToken,
    );
  }

  /**
   * Returns one webhook by hook id.
   */
  public async getWebhook(
    githubToken: string,
    fullName: string,
    hookId: number,
  ): Promise<GitHubWebhook> {
    const { data } = await this.request<GitHubWebhookApiResponse>(
      {
        method: 'GET',
        url: `/repos/${fullName}/hooks/${hookId}`,
      },
      githubToken,
    );

    return {
      id: data.id,
      url: data.config.url ?? '',
    };
  }

  /**
   * Updates a webhook callback URL.
   */
  public async updateWebhookUrl(
    githubToken: string,
    fullName: string,
    hookId: number,
    webhookUrl: string,
  ): Promise<void> {
    await this.request(
      {
        method: 'PATCH',
        url: `/repos/${fullName}/hooks/${hookId}`,
        data: {
          config: {
            url: webhookUrl,
          },
        },
      },
      githubToken,
    );
  }

  /**
   * Creates or updates a repository Actions secret.
   */
  public async upsertActionsSecret(
    githubToken: string,
    fullName: string,
    secretName: string,
    secretValue: string,
  ): Promise<void> {
    const { data: publicKey } = await this.request<GitHubActionsPublicKeyApiResponse>(
      {
        method: 'GET',
        url: `/repos/${fullName}/actions/secrets/public-key`,
      },
      githubToken,
    );

    const encryptedValue = await this.encryptActionsSecret(secretValue, publicKey.key);
    const encodedSecretName = encodeURIComponent(secretName);

    await this.request(
      {
        method: 'PUT',
        url: `/repos/${fullName}/actions/secrets/${encodedSecretName}`,
        data: {
          encrypted_value: encryptedValue,
          key_id: publicKey.key_id,
        },
      },
      githubToken,
    );
  }

  /**
   * Creates or updates a file in a GitHub repository by committing to a branch.
   */
  public async commitFile(
    githubToken: string,
    fullName: string,
    path: string,
    content: string,
    message: string,
    branch: string,
  ): Promise<void> {
    const encodedPath = this.encodeFilePath(path);
    const existingFileSha = await this.getExistingFileSha(githubToken, fullName, encodedPath, branch);
    const encodedContent = Buffer.from(content, 'utf8').toString('base64');

    await this.request(
      {
        method: 'PUT',
        url: `/repos/${fullName}/contents/${encodedPath}`,
        data: {
          message,
          content: encodedContent,
          branch,
          ...(existingFileSha ? { sha: existingFileSha } : {}),
        },
      },
      githubToken,
    );
  }

  /**
   * Verifies a GitHub webhook signature using HMAC-SHA256.
   */
  public verifyWebhookSignature(
    payload: Buffer,
    signature: string | undefined,
    secret: string,
  ): boolean {
    if (!signature?.startsWith('sha256=')) {
      return false;
    }

    const providedHexDigest = signature.slice('sha256='.length);
    if (!/^[a-f0-9]{64}$/i.test(providedHexDigest)) {
      return false;
    }

    const expectedDigest = createHmac('sha256', secret).update(payload).digest();
    const providedDigest = Buffer.from(providedHexDigest, 'hex');
    if (providedDigest.length !== expectedDigest.length) {
      return false;
    }

    return timingSafeEqual(providedDigest, expectedDigest);
  }

  private async encryptActionsSecret(secretValue: string, base64PublicKey: string): Promise<string> {
    const sodiumLib = await this.getSodium();
    const publicKeyBytes = sodiumLib.from_base64(
      base64PublicKey,
      sodiumLib.base64_variants.ORIGINAL,
    );
    const secretBytes = sodiumLib.from_string(secretValue);
    const encryptedBytes = sodiumLib.crypto_box_seal(secretBytes, publicKeyBytes);
    return sodiumLib.to_base64(encryptedBytes, sodiumLib.base64_variants.ORIGINAL);
  }

  private async getSodium(): Promise<typeof sodium> {
    if (!GitHubService.sodiumReadyPromise) {
      GitHubService.sodiumReadyPromise = sodium.ready;
    }
    await GitHubService.sodiumReadyPromise;
    return sodium;
  }

  private async getExistingFileSha(
    githubToken: string,
    fullName: string,
    encodedPath: string,
    branch: string,
  ): Promise<string | null> {
    try {
      const { data } = await this.request<GitHubContentApiResponse>(
        {
          method: 'GET',
          url: `/repos/${fullName}/contents/${encodedPath}`,
          params: {
            ref: branch,
          },
        },
        githubToken,
      );

      return data.sha;
    } catch (error) {
      if (this.isHttpStatus(error, 404)) {
        return null;
      }

      throw error;
    }
  }

  private encodeFilePath(path: string): string {
    return path
      .split('/')
      .map((segment) => encodeURIComponent(segment))
      .join('/');
  }

  private mapRepository(repository: GitHubRepositoryApiResponse): GitHubRepo {
    return {
      id: repository.id,
      name: repository.name,
      fullName: repository.full_name,
      private: repository.private,
      defaultBranch: repository.default_branch,
      cloneUrl: repository.clone_url,
      htmlUrl: repository.html_url,
    };
  }

  private async request<T = unknown>(
    requestConfig: AxiosRequestConfig,
    githubToken: string,
  ): Promise<AxiosResponse<T>> {
    return firstValueFrom(
      this.httpService.request<T>({
        ...requestConfig,
        baseURL: GitHubService.BASE_URL,
        headers: {
          Accept: 'application/vnd.github+json',
          Authorization: `Bearer ${githubToken}`,
          'X-GitHub-Api-Version': GitHubService.API_VERSION,
          'User-Agent': GitHubService.USER_AGENT,
          ...requestConfig.headers,
        },
      }),
    );
  }

  private isHttpStatus(error: unknown, statusCode: number): boolean {
    if (!error || typeof error !== 'object') {
      return false;
    }

    const maybeError = error as {
      response?: {
        status?: unknown;
      };
    };

    return maybeError.response?.status === statusCode;
  }
}

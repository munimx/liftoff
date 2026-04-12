import type { User } from '@prisma/client';
import { ErrorCodes, UserPublicDto } from '@liftoff/shared';
import { Injectable } from '@nestjs/common';
import { Exceptions } from '../common/exceptions/app.exception';
import { EncryptionService } from '../common/services/encryption.service';
import { PrismaService } from '../prisma/prisma.service';
import { UpdateProfileDto } from './dto/update-profile.dto';

/**
 * Minimal profile information extracted from GitHub OAuth.
 */
export interface GitHubProfile {
  githubId: string;
  email: string;
  githubUsername: string;
  name: string | null;
  avatarUrl: string | null;
  githubAccessToken: string;
}

/**
 * Handles user persistence and profile operations.
 */
@Injectable()
export class UsersService {
  public constructor(
    private readonly prismaService: PrismaService,
    private readonly encryptionService: EncryptionService,
  ) {}

  /**
   * Creates or updates a user from GitHub OAuth profile data.
   */
  public async findOrCreateFromGitHub(githubProfile: GitHubProfile): Promise<User> {
    const encryptedGitHubToken = this.encryptionService.encrypt(githubProfile.githubAccessToken);

    return this.prismaService.user.upsert({
      where: { githubId: githubProfile.githubId },
      update: {
        email: githubProfile.email,
        githubUsername: githubProfile.githubUsername,
        name: githubProfile.name,
        avatarUrl: githubProfile.avatarUrl,
        githubToken: encryptedGitHubToken,
        deletedAt: null,
      },
      create: {
        email: githubProfile.email,
        githubId: githubProfile.githubId,
        githubUsername: githubProfile.githubUsername,
        name: githubProfile.name,
        avatarUrl: githubProfile.avatarUrl,
        githubToken: encryptedGitHubToken,
      },
    });
  }

  /**
   * Returns an active user by ID.
   */
  public async findById(id: string): Promise<User | null> {
    return this.prismaService.user.findFirst({
      where: {
        id,
        deletedAt: null,
      },
    });
  }

  /**
   * Returns an active user by email.
   */
  public async findByEmail(email: string): Promise<User | null> {
    return this.prismaService.user.findFirst({
      where: {
        email,
        deletedAt: null,
      },
    });
  }

  /**
   * Updates user profile fields that are editable by the user.
   */
  public async updateProfile(id: string, dto: UpdateProfileDto): Promise<User> {
    const user = await this.findById(id);
    if (!user) {
      throw Exceptions.notFound('User not found', ErrorCodes.USER_NOT_FOUND);
    }

    return this.prismaService.user.update({
      where: { id },
      data: { name: dto.name },
    });
  }

  /**
   * Soft-deletes a user account and revokes active refresh tokens.
   */
  public async deleteAccount(id: string): Promise<void> {
    const user = await this.findById(id);
    if (!user) {
      throw Exceptions.notFound('User not found', ErrorCodes.USER_NOT_FOUND);
    }

    const revokedAt = new Date();
    await this.prismaService.$transaction([
      this.prismaService.user.update({
        where: { id },
        data: { deletedAt: revokedAt },
      }),
      this.prismaService.refreshToken.updateMany({
        where: {
          userId: id,
          revokedAt: null,
        },
        data: { revokedAt },
      }),
    ]);
  }

  /**
   * Converts a Prisma user model into the public API user DTO.
   */
  public toPublicDto(user: User): UserPublicDto {
    return {
      id: user.id,
      email: user.email,
      githubUsername: user.githubUsername,
      name: user.name,
      avatarUrl: user.avatarUrl,
      createdAt: user.createdAt.toISOString(),
    };
  }
}

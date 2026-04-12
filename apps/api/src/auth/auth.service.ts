import { ErrorCodes } from '@liftoff/shared';
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { randomUUID } from 'crypto';
import { Exceptions } from '../common/exceptions/app.exception';
import { EncryptionService } from '../common/services/encryption.service';
import { PrismaService } from '../prisma/prisma.service';
import { AuthTokenPair } from './types/auth.types';

type DecodedPayloadWithExp = {
  exp?: number;
};

/**
 * Handles access/refresh token lifecycle and persistence.
 */
@Injectable()
export class AuthService {
  public constructor(
    private readonly prismaService: PrismaService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly encryptionService: EncryptionService,
  ) {}

  /**
   * Generates a fresh access token and refresh token pair.
   */
  public async generateTokens(userId: string, email: string): Promise<AuthTokenPair> {
    const accessToken = await this.jwtService.signAsync(
      { sub: userId, email },
      {
        secret: this.configService.getOrThrow<string>('JWT_SECRET'),
        expiresIn: this.configService.getOrThrow<string>('JWT_EXPIRES_IN'),
      },
    );

    const refreshTokenId = randomUUID();
    const refreshToken = await this.jwtService.signAsync(
      { sub: userId, jti: refreshTokenId },
      {
        secret: this.configService.getOrThrow<string>('JWT_REFRESH_SECRET'),
        expiresIn: this.configService.getOrThrow<string>('JWT_REFRESH_EXPIRES_IN'),
      },
    );

    const refreshTokenHash = await this.encryptionService.hash(refreshToken);

    await this.prismaService.refreshToken.create({
      data: {
        id: refreshTokenId,
        userId,
        token: refreshTokenHash,
        expiresAt: this.resolveRefreshTokenExpiry(refreshToken),
      },
    });

    return {
      accessToken,
      refreshToken,
    };
  }

  /**
   * Rotates a refresh token and returns a new token pair.
   */
  public async refreshTokens(userId: string, tokenId: string): Promise<AuthTokenPair> {
    const tokenRecord = await this.prismaService.refreshToken.findUnique({
      where: { id: tokenId },
      include: { user: true },
    });

    if (!tokenRecord || tokenRecord.userId !== userId || tokenRecord.user.deletedAt !== null) {
      throw Exceptions.unauthorized('Invalid refresh token', ErrorCodes.AUTH_INVALID_TOKEN);
    }

    if (tokenRecord.revokedAt !== null) {
      throw Exceptions.unauthorized('Refresh token has been revoked', ErrorCodes.AUTH_INVALID_TOKEN);
    }

    if (tokenRecord.expiresAt.getTime() <= Date.now()) {
      throw Exceptions.unauthorized('Refresh token has expired', ErrorCodes.AUTH_TOKEN_EXPIRED);
    }

    const revokeResult = await this.prismaService.refreshToken.updateMany({
      where: {
        id: tokenId,
        userId,
        revokedAt: null,
      },
      data: {
        revokedAt: new Date(),
      },
    });

    if (revokeResult.count === 0) {
      throw Exceptions.unauthorized('Refresh token is no longer active', ErrorCodes.AUTH_INVALID_TOKEN);
    }

    return this.generateTokens(tokenRecord.userId, tokenRecord.user.email);
  }

  /**
   * Revokes a single refresh token by ID.
   */
  public async revokeRefreshToken(tokenId: string): Promise<void> {
    await this.prismaService.refreshToken.updateMany({
      where: {
        id: tokenId,
        revokedAt: null,
      },
      data: {
        revokedAt: new Date(),
      },
    });
  }

  /**
   * Revokes all active refresh tokens for a user.
   */
  public async revokeAllUserTokens(userId: string): Promise<void> {
    await this.prismaService.refreshToken.updateMany({
      where: {
        userId,
        revokedAt: null,
      },
      data: {
        revokedAt: new Date(),
      },
    });
  }

  private resolveRefreshTokenExpiry(refreshToken: string): Date {
    const payload = this.jwtService.decode(refreshToken);
    if (
      !payload ||
      typeof payload !== 'object' ||
      typeof (payload as DecodedPayloadWithExp).exp !== 'number'
    ) {
      throw Exceptions.internalError('Failed to resolve refresh token expiry');
    }

    const expiresAtUnix = (payload as DecodedPayloadWithExp).exp as number;
    return new Date(expiresAtUnix * 1000);
  }
}

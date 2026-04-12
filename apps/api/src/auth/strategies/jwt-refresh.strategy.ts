import { ErrorCodes } from '@liftoff/shared';
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { Exceptions } from '../../common/exceptions/app.exception';
import { EncryptionService } from '../../common/services/encryption.service';
import { PrismaService } from '../../prisma/prisma.service';
import { JwtRefreshPayload, RefreshTokenPrincipal } from '../types/auth.types';

type RequestWithCookies = {
  cookies?: {
    refreshToken?: unknown;
  };
};

/**
 * Passport strategy for refresh token validation.
 */
@Injectable()
export class JwtRefreshStrategy extends PassportStrategy(Strategy, 'jwt-refresh') {
  public constructor(
    configService: ConfigService,
    private readonly prismaService: PrismaService,
    private readonly encryptionService: EncryptionService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromExtractors([
        (request: RequestWithCookies): string | null => {
          const refreshToken = request.cookies?.refreshToken;
          return typeof refreshToken === 'string' ? refreshToken : null;
        },
      ]),
      secretOrKey: configService.getOrThrow<string>('JWT_REFRESH_SECRET'),
      passReqToCallback: true,
      ignoreExpiration: false,
    });
  }

  /**
   * Verifies that refresh token payload maps to an active stored token.
   */
  public async validate(
    request: RequestWithCookies,
    payload: JwtRefreshPayload,
  ): Promise<RefreshTokenPrincipal> {
    const refreshToken = request.cookies?.refreshToken;
    if (typeof refreshToken !== 'string' || refreshToken.length === 0) {
      throw Exceptions.unauthorized('Refresh token is required', ErrorCodes.AUTH_INVALID_TOKEN);
    }

    if (!payload.sub || !payload.jti) {
      throw Exceptions.unauthorized('Invalid refresh token payload', ErrorCodes.AUTH_INVALID_TOKEN);
    }

    const tokenRecord = await this.prismaService.refreshToken.findUnique({
      where: { id: payload.jti },
    });
    if (!tokenRecord || tokenRecord.userId !== payload.sub) {
      throw Exceptions.unauthorized('Invalid refresh token', ErrorCodes.AUTH_INVALID_TOKEN);
    }

    if (tokenRecord.revokedAt !== null) {
      throw Exceptions.unauthorized('Refresh token has been revoked', ErrorCodes.AUTH_INVALID_TOKEN);
    }

    if (tokenRecord.expiresAt.getTime() <= Date.now()) {
      throw Exceptions.unauthorized('Refresh token has expired', ErrorCodes.AUTH_TOKEN_EXPIRED);
    }

    const tokenMatches = await this.encryptionService.compare(refreshToken, tokenRecord.token);
    if (!tokenMatches) {
      throw Exceptions.unauthorized('Refresh token is invalid', ErrorCodes.AUTH_INVALID_TOKEN);
    }

    return {
      userId: payload.sub,
      tokenId: payload.jti,
    };
  }
}

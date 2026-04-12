import type { User } from '@prisma/client';
import { ErrorCodes } from '@liftoff/shared';
import {
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Req,
  Res,
  UseGuards,
  VERSION_NEUTRAL,
  Version,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { AuthGuard } from '@nestjs/passport';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CurrentUser, Public } from '../common/decorators';
import { Exceptions } from '../common/exceptions/app.exception';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { AuthService } from './auth.service';
import { JwtRefreshPayload, RefreshTokenPrincipal } from './types/auth.types';

const REFRESH_COOKIE_NAME = 'refreshToken';
const REFRESH_COOKIE_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;

type CookieOptions = {
  httpOnly?: boolean;
  secure?: boolean;
  sameSite?: 'strict' | 'lax' | 'none';
  maxAge?: number;
  path?: string;
};

type ResponseWithCookies = {
  cookie(name: string, value: string, options?: CookieOptions): void;
  clearCookie(name: string, options?: CookieOptions): void;
  redirect(url: string): void;
};

type RequestWithUser = {
  user?: User;
};

type RequestWithCookies = {
  cookies?: {
    refreshToken?: unknown;
  };
};

/**
 * Authentication endpoints for OAuth login and token lifecycle.
 */
@Controller('auth')
@ApiTags('Auth')
@ApiBearerAuth()
export class AuthController {
  public constructor(
    private readonly authService: AuthService,
    private readonly configService: ConfigService,
    private readonly jwtService: JwtService,
  ) {}

  /**
   * Starts the GitHub OAuth flow.
   */
  @Public()
  @Version(VERSION_NEUTRAL)
  @UseGuards(AuthGuard('github'))
  @Get('github')
  public githubLogin(): void {
    return;
  }

  /**
   * Handles GitHub OAuth callback and redirects to the web app with an access token.
   */
  @Public()
  @Version(VERSION_NEUTRAL)
  @UseGuards(AuthGuard('github'))
  @Get('github/callback')
  public async githubCallback(
    @Req() request: RequestWithUser,
    @Res({ passthrough: true }) response: ResponseWithCookies,
  ): Promise<void> {
    if (!request.user) {
      throw Exceptions.unauthorized('GitHub authentication failed', ErrorCodes.AUTH_GITHUB_FAILED);
    }

    const tokens = await this.authService.generateTokens(request.user.id, request.user.email);
    this.setRefreshTokenCookie(response, tokens.refreshToken);

    const frontendUrl = this.configService.getOrThrow<string>('FRONTEND_URL');
    response.redirect(`${frontendUrl}/auth/callback?token=${encodeURIComponent(tokens.accessToken)}`);
  }

  /**
   * Rotates refresh token and returns a new access token.
   */
  @Public()
  @UseGuards(AuthGuard('jwt-refresh'))
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  public async refresh(
    @CurrentUser() refreshPrincipal: RefreshTokenPrincipal,
    @Res({ passthrough: true }) response: ResponseWithCookies,
  ): Promise<{ accessToken: string }> {
    const tokens = await this.authService.refreshTokens(
      refreshPrincipal.userId,
      refreshPrincipal.tokenId,
    );
    this.setRefreshTokenCookie(response, tokens.refreshToken);

    return { accessToken: tokens.accessToken };
  }

  /**
   * Logs the user out by revoking the current refresh token and clearing the cookie.
   */
  @UseGuards(JwtAuthGuard)
  @Delete('logout')
  @HttpCode(HttpStatus.NO_CONTENT)
  public async logout(
    @CurrentUser() user: User,
    @Req() request: RequestWithCookies,
    @Res({ passthrough: true }) response: ResponseWithCookies,
  ): Promise<void> {
    const refreshToken = request.cookies?.refreshToken;
    if (typeof refreshToken === 'string' && refreshToken.length > 0) {
      const decodedPayload = this.jwtService.decode(refreshToken);
      if (
        this.isRefreshTokenPayload(decodedPayload) &&
        decodedPayload.sub === user.id &&
        decodedPayload.jti.length > 0
      ) {
        await this.authService.revokeRefreshToken(decodedPayload.jti);
      }
    }

    response.clearCookie(REFRESH_COOKIE_NAME, this.getRefreshCookieOptions());
  }

  private setRefreshTokenCookie(response: ResponseWithCookies, refreshToken: string): void {
    response.cookie(REFRESH_COOKIE_NAME, refreshToken, this.getRefreshCookieOptions());
  }

  private getRefreshCookieOptions(): CookieOptions {
    return {
      httpOnly: true,
      secure: this.configService.get<string>('NODE_ENV') === 'production',
      sameSite: 'strict',
      maxAge: REFRESH_COOKIE_MAX_AGE_MS,
      path: '/',
    };
  }

  private isRefreshTokenPayload(payload: unknown): payload is JwtRefreshPayload {
    if (!payload || typeof payload !== 'object') {
      return false;
    }

    const decodedPayload = payload as Partial<JwtRefreshPayload>;
    return typeof decodedPayload.sub === 'string' && typeof decodedPayload.jti === 'string';
  }
}

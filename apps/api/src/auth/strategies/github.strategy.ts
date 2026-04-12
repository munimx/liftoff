import type { User } from '@prisma/client';
import { ErrorCodes } from '@liftoff/shared';
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { Profile, Strategy } from 'passport-github2';
import { Exceptions } from '../../common/exceptions/app.exception';
import { UsersService } from '../../users/users.service';

/**
 * Passport strategy for GitHub OAuth authentication.
 */
@Injectable()
export class GithubStrategy extends PassportStrategy(Strategy, 'github') {
  public constructor(
    configService: ConfigService,
    private readonly usersService: UsersService,
  ) {
    super({
      clientID: configService.getOrThrow<string>('GITHUB_CLIENT_ID'),
      clientSecret: configService.getOrThrow<string>('GITHUB_CLIENT_SECRET'),
      callbackURL: configService.getOrThrow<string>('GITHUB_CALLBACK_URL'),
      scope: ['read:user', 'user:email', 'repo', 'write:repo_hook', 'workflow'],
    });
  }

  /**
   * Upserts and returns the authenticated GitHub user.
   */
  public async validate(
    accessToken: string,
    _refreshToken: string,
    profile: Profile,
    done: (error: Error | null, user?: User) => void,
  ): Promise<void> {
    const email = profile.emails?.[0]?.value;
    const githubUsername = profile.username;
    if (!email || !githubUsername) {
      done(
        Exceptions.unauthorized(
          'GitHub account must expose username and primary email',
          ErrorCodes.AUTH_GITHUB_FAILED,
        ),
      );
      return;
    }

    const user = await this.usersService.findOrCreateFromGitHub({
      githubId: profile.id,
      email,
      githubUsername,
      name: profile.displayName || null,
      avatarUrl: profile.photos?.[0]?.value || null,
      githubAccessToken: accessToken,
    });
    done(null, user);
  }
}

import type { User } from '@prisma/client';
import { ErrorCodes } from '@liftoff/shared';
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { Exceptions } from '../../common/exceptions/app.exception';
import { UsersService } from '../../users/users.service';
import { JwtAccessPayload } from '../types/auth.types';

/**
 * Passport strategy for access JWT validation.
 */
@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy, 'jwt') {
  public constructor(
    configService: ConfigService,
    private readonly usersService: UsersService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: configService.getOrThrow<string>('JWT_SECRET'),
    });
  }

  /**
   * Resolves authenticated user from JWT payload.
   */
  public async validate(payload: JwtAccessPayload): Promise<User> {
    const user = await this.usersService.findById(payload.sub);
    if (!user) {
      throw Exceptions.unauthorized('Invalid access token', ErrorCodes.AUTH_INVALID_TOKEN);
    }

    return user;
  }
}

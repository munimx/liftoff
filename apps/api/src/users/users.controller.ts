import type { User } from '@prisma/client';
import { UserPublicDto } from '@liftoff/shared';
import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Patch,
  Res,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../common/decorators';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { UsersService } from './users.service';

const REFRESH_COOKIE_NAME = 'refreshToken';

type ResponseWithCookies = {
  clearCookie(
    name: string,
    options?: {
      httpOnly?: boolean;
      secure?: boolean;
      sameSite?: 'strict' | 'lax' | 'none';
      path?: string;
    },
  ): void;
};

/**
 * Authenticated user profile endpoints.
 */
@Controller('users')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
@ApiTags('Users')
export class UsersController {
  public constructor(private readonly usersService: UsersService) {}

  /**
   * Returns the currently authenticated user profile.
   */
  @Get('me')
  public getMe(@CurrentUser() user: User): UserPublicDto {
    return this.usersService.toPublicDto(user);
  }

  /**
   * Updates the authenticated user's profile fields.
   */
  @Patch('me')
  public async updateMe(
    @CurrentUser() user: User,
    @Body() dto: UpdateProfileDto,
  ): Promise<UserPublicDto> {
    const updatedUser = await this.usersService.updateProfile(user.id, dto);
    return this.usersService.toPublicDto(updatedUser);
  }

  /**
   * Soft-deletes the authenticated account and clears refresh cookie.
   */
  @Delete('me')
  @HttpCode(HttpStatus.NO_CONTENT)
  public async deleteMe(
    @CurrentUser() user: User,
    @Res({ passthrough: true }) response: ResponseWithCookies,
  ): Promise<void> {
    await this.usersService.deleteAccount(user.id);
    response.clearCookie(REFRESH_COOKIE_NAME, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      path: '/',
    });
  }
}

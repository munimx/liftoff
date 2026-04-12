import type { User } from '@prisma/client';
import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../common/decorators';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { CreateDOAccountDto } from './dto/create-do-account.dto';
import { DOAccountResponseDto } from './dto/do-account-response.dto';
import { DOAccountsService } from './do-accounts.service';

/**
 * DigitalOcean account management endpoints.
 */
@Controller('do-accounts')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
@ApiTags('DO Accounts')
export class DOAccountsController {
  public constructor(private readonly doAccountsService: DOAccountsService) {}

  /**
   * Connects and validates a DigitalOcean account.
   */
  @Post()
  public create(
    @CurrentUser() user: User,
    @Body() dto: CreateDOAccountDto,
  ): Promise<DOAccountResponseDto> {
    return this.doAccountsService.create(user.id, dto);
  }

  /**
   * Lists all connected DigitalOcean accounts for the current user.
   */
  @Get()
  public findAll(@CurrentUser() user: User): Promise<DOAccountResponseDto[]> {
    return this.doAccountsService.findAllByUser(user.id);
  }

  /**
   * Returns one connected DigitalOcean account by ID.
   */
  @Get(':id')
  public findOne(
    @Param('id') id: string,
    @CurrentUser() user: User,
  ): Promise<DOAccountResponseDto> {
    return this.doAccountsService.findOne(id, user.id);
  }

  /**
   * Re-validates a connected DigitalOcean token.
   */
  @Post(':id/validate')
  public validate(
    @Param('id') id: string,
    @CurrentUser() user: User,
  ): Promise<{ valid: boolean; email?: string; error?: string }> {
    return this.doAccountsService.validate(id, user.id);
  }

  /**
   * Deletes a connected DigitalOcean account.
   */
  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  public async delete(@Param('id') id: string, @CurrentUser() user: User): Promise<void> {
    await this.doAccountsService.delete(id, user.id);
  }
}

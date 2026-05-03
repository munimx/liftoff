import type { User } from '@prisma/client';
import {
  Body,
  Controller,
  MaxFileSizeValidator,
  ParseFilePipe,
  Post,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiBearerAuth, ApiConsumes, ApiTags } from '@nestjs/swagger';
import type { AppType, SizeTier } from '@liftoff/shared';
import { CurrentUser } from '../common/decorators';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { DeployTemplateDto } from './dto/deploy-template.dto';
import { UploadCodeDto } from './dto/upload-code.dto';
import { UploadResult, UploadService } from './upload.service';

/**
 * Simple Mode upload and template deploy endpoints.
 */
@Controller('upload')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
@ApiTags('Upload')
export class UploadController {
  public constructor(private readonly uploadService: UploadService) {}

  /**
   * Accepts a zip upload with wizard config and deploys it.
   */
  @Post()
  @UseInterceptors(FileInterceptor('file'))
  @ApiConsumes('multipart/form-data')
  public async uploadCode(
    @CurrentUser() user: User,
    @UploadedFile(
      new ParseFilePipe({
        validators: [new MaxFileSizeValidator({ maxSize: 50 * 1024 * 1024 })],
      }),
    )
    file: Express.Multer.File,
    @Body() dto: UploadCodeDto,
  ): Promise<UploadResult> {
    return this.uploadService.handleUpload(
      user.id,
      file,
      dto.appType as AppType,
      dto.size as SizeTier,
      dto.database,
      dto.domain,
      dto.projectName,
      dto.projectDescription,
      dto.doAccountId,
    );
  }

  /**
   * Deploys a starter template from the gallery.
   */
  @Post('template')
  public async deployTemplate(
    @CurrentUser() user: User,
    @Body() dto: DeployTemplateDto,
  ): Promise<UploadResult> {
    return this.uploadService.handleTemplateDeploy(
      user.id,
      dto.templateSlug,
      dto.projectName,
      dto.doAccountId,
    );
  }
}

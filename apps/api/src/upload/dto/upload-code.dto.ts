import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsIn, IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';
import { Transform } from 'class-transformer';
import { APP_TYPES } from '@liftoff/shared';

/**
 * Body fields sent alongside the multipart zip upload.
 */
export class UploadCodeDto {
  @ApiProperty({ enum: APP_TYPES, example: 'nextjs' })
  @IsString()
  @IsNotEmpty()
  @IsIn([...APP_TYPES])
  public appType!: string;

  @ApiProperty({ enum: ['small', 'medium', 'large'], example: 'small' })
  @IsString()
  @IsIn(['small', 'medium', 'large'])
  public size!: string;

  @ApiProperty({ example: false })
  @Transform(({ value }) => value === 'true' || value === true)
  @IsBoolean()
  public database!: boolean;

  @ApiPropertyOptional({ example: 'myapp.com' })
  @IsOptional()
  @IsString()
  @MaxLength(253)
  public domain?: string;

  @ApiProperty({ example: 'my-project' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  public projectName!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(500)
  public projectDescription?: string;

  @ApiProperty({ description: 'DO Account ID to deploy with.' })
  @IsString()
  @IsNotEmpty()
  public doAccountId!: string;
}

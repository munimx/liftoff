import { PartialType } from '@nestjs/mapped-types';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsOptional, IsString, Matches, MaxLength } from 'class-validator';
import { CreateEnvironmentDto } from './create-environment.dto';

/**
 * Request payload for updating mutable environment fields.
 */
export class UpdateEnvironmentDto extends PartialType(CreateEnvironmentDto) {
  @ApiPropertyOptional({ example: 'production' })
  @IsOptional()
  @IsString()
  @MaxLength(40)
  @Matches(/^[a-z0-9-]+$/)
  public override name?: string;

  @ApiPropertyOptional({ example: 'main' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  public override gitBranch?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  public override doAccountId?: string;

  @ApiPropertyOptional({ enum: ['APP'] })
  @IsOptional()
  @IsString()
  @IsIn(['APP'])
  public override serviceType?: 'APP';
}

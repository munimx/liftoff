import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsNotEmpty, IsString, Matches, MaxLength } from 'class-validator';

/**
 * Request payload for creating an environment under a project.
 */
export class CreateEnvironmentDto {
  @ApiProperty({ example: 'production' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(40)
  @Matches(/^[a-z0-9-]+$/)
  public name!: string;

  @ApiProperty({ example: 'main' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  public gitBranch!: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  public doAccountId!: string;

  @ApiPropertyOptional({ enum: ['APP'], default: 'APP' })
  @IsString()
  @IsIn(['APP'])
  public serviceType: 'APP' = 'APP';
}

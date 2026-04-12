import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';

/**
 * Request payload for creating a project.
 */
export class CreateProjectDto {
  @ApiProperty({ example: 'my-webapp' })
  @IsString()
  @IsNotEmpty()
  @MinLength(2)
  @MaxLength(40)
  @Matches(/^[a-z0-9][a-z0-9-]*$/, {
    message: 'Lowercase letters, numbers, hyphens only',
  })
  public name!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(500)
  public description?: string;
}

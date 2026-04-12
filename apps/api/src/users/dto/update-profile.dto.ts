import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, MaxLength } from 'class-validator';

/**
 * Payload for updating editable profile fields.
 */
export class UpdateProfileDto {
  @ApiPropertyOptional({
    example: 'Ada Lovelace',
    maxLength: 100,
  })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  public name?: string;
}

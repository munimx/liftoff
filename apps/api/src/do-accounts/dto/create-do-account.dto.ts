import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsNotEmpty, IsOptional, IsString, MinLength } from 'class-validator';
import { DO_REGIONS, DoRegion } from '../constants/do-regions.constant';

/**
 * Request payload for connecting a user's DigitalOcean account.
 */
export class CreateDOAccountDto {
  @ApiProperty({
    example: 'dop_v1_abcdefghijklmnopqrstuvwxyz1234567890abcdefghijklmnopqrstuvwxyz1234567890',
  })
  @IsString()
  @IsNotEmpty()
  @MinLength(50)
  public doToken!: string;

  @ApiPropertyOptional({
    enum: DO_REGIONS,
    default: 'nyc3',
  })
  @IsString()
  @IsOptional()
  @IsIn(DO_REGIONS)
  public region: DoRegion = 'nyc3';
}

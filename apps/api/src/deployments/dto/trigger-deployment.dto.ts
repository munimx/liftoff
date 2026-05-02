import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

/**
 * Optional deployment trigger payload.
 */
export class TriggerDeploymentDto {
  @ApiPropertyOptional({
    description: 'Optional image URI to deploy directly.',
    example: 'registry.digitalocean.com/my-registry/my-app/production:abc123',
  })
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(512)
  public imageUri?: string;

  @ApiPropertyOptional({ description: 'Optional commit SHA metadata.', example: 'abc123def456' })
  @IsOptional()
  @IsString()
  @MaxLength(64)
  public commitSha?: string;

  @ApiPropertyOptional({ description: 'Optional commit message metadata.' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  public commitMessage?: string;

  @ApiPropertyOptional({ description: 'Optional branch metadata.', example: 'main' })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  public branch?: string;
}

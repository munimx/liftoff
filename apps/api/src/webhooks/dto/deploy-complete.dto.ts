import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, Matches, MaxLength } from 'class-validator';

/**
 * Request payload for workflow deploy completion callbacks.
 */
export class DeployCompleteDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  public environmentId!: string;

  @ApiProperty({
    example: 'registry.digitalocean.com/liftoff/my-webapp/production:abc1234',
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(500)
  @Matches(/^registry\.digitalocean\.com\/[a-z0-9-]+\/[a-z0-9-]+\/[a-z0-9-]+:[a-f0-9]+$/i)
  public imageUri!: string;

  @ApiProperty({ example: 'abc1234567890def' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(64)
  @Matches(/^[a-f0-9]+$/i)
  public commitSha!: string;
}

import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

/**
 * Body payload for deploying a starter template.
 */
export class DeployTemplateDto {
  @ApiProperty({ example: 'nextjs-blog' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  public templateSlug!: string;

  @ApiProperty({ example: 'my-blog' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  public projectName!: string;

  @ApiProperty({ description: 'DO Account ID to deploy with.' })
  @IsString()
  @IsNotEmpty()
  public doAccountId!: string;
}

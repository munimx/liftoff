import { ApiProperty } from '@nestjs/swagger';
import { IsInt, IsNotEmpty, IsString, Matches, MaxLength, Min } from 'class-validator';

/**
 * Request payload for connecting a GitHub repository to a project.
 */
export class ConnectRepositoryDto {
  @ApiProperty({ example: 123456789 })
  @IsInt()
  @Min(1)
  public githubRepoId!: number;

  @ApiProperty({ example: 'liftoffdev/my-webapp' })
  @IsString()
  @IsNotEmpty()
  @Matches(/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/)
  public fullName!: string;

  @ApiProperty({ example: 'main' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  @Matches(/^[A-Za-z0-9._/-]+$/)
  public branch!: string;
}

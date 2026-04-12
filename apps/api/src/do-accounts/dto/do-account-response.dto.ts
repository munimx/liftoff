import type { DOAccountDto } from '@liftoff/shared';
import { ApiProperty } from '@nestjs/swagger';

/**
 * Sanitized DigitalOcean account response shape without sensitive token data.
 */
export class DOAccountResponseDto implements DOAccountDto {
  @ApiProperty()
  public id!: string;

  @ApiProperty()
  public region!: string;

  @ApiProperty({ nullable: true })
  public validatedAt!: string | null;

  @ApiProperty()
  public createdAt!: string;
}

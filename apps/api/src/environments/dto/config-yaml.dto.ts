import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';

/**
 * Request payload containing raw liftoff.yml YAML.
 */
export class ConfigYamlDto {
  @ApiProperty({
    example:
      'version: "1.0"\nservice:\n  name: test-app\n  type: app\n  region: nyc3\nruntime:\n  instance_size: apps-s-1vcpu-0.5gb\n  port: 3000\n  replicas: 1\nhealthcheck:\n  path: /',
  })
  @IsString()
  @IsNotEmpty()
  public configYaml!: string;
}

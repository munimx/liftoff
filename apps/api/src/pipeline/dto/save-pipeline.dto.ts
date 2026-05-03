import { IsArray, IsNumber, IsObject, IsOptional, IsString, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty } from '@nestjs/swagger';

class PipelineNodePositionDto {
  @IsNumber()
  @ApiProperty()
  x!: number;

  @IsNumber()
  @ApiProperty()
  y!: number;
}

class PipelineNodeDto {
  @IsString()
  @ApiProperty()
  id!: string;

  @IsString()
  @ApiProperty()
  type!: string;

  @IsObject()
  @ApiProperty()
  data!: Record<string, unknown>;

  @ValidateNested()
  @Type(() => PipelineNodePositionDto)
  @ApiProperty()
  position!: PipelineNodePositionDto;
}

class PipelineEdgeDto {
  @IsString()
  @ApiProperty()
  id!: string;

  @IsString()
  @ApiProperty()
  source!: string;

  @IsString()
  @ApiProperty()
  target!: string;

  @IsOptional()
  @IsString()
  @ApiProperty({ required: false })
  sourceHandle?: string;

  @IsOptional()
  @IsString()
  @ApiProperty({ required: false })
  targetHandle?: string;
}

export class SavePipelineDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PipelineNodeDto)
  @ApiProperty({ type: [PipelineNodeDto] })
  nodes!: PipelineNodeDto[];

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PipelineEdgeDto)
  @ApiProperty({ type: [PipelineEdgeDto] })
  edges!: PipelineEdgeDto[];
}

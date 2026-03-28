import { IsString, IsNotEmpty, IsBoolean, IsInt, IsOptional, Min } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateCheckpointDto {
  @ApiProperty({ description: 'Exercise ID' })
  @IsString()
  @IsNotEmpty()
  exerciseId: string;

  @ApiProperty({ description: 'Display order', example: 1 })
  @IsInt()
  @Min(1)
  order: number;

  @ApiProperty({ description: 'Human-readable description', example: 'Check if SELECT statement is used' })
  @IsString()
  @IsNotEmpty()
  description: string;

  @ApiProperty({ description: 'Regex pattern for matching', example: 'SELECT\\s+.*\\s+FROM' })
  @IsString()
  @IsNotEmpty()
  pattern: string;

  @ApiPropertyOptional({ description: 'Case sensitive matching', default: false })
  @IsBoolean()
  @IsOptional()
  caseSensitive?: boolean;
}

export class UpdateCheckpointDto {
  @ApiPropertyOptional({ description: 'Display order' })
  @IsInt()
  @Min(1)
  @IsOptional()
  order?: number;

  @ApiPropertyOptional({ description: 'Human-readable description' })
  @IsString()
  @IsOptional()
  description?: string;

  @ApiPropertyOptional({ description: 'Regex pattern for matching' })
  @IsString()
  @IsOptional()
  pattern?: string;

  @ApiPropertyOptional({ description: 'Case sensitive matching' })
  @IsBoolean()
  @IsOptional()
  caseSensitive?: boolean;
}

export class CheckpointResponseDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  exerciseId: string;

  @ApiProperty()
  order: number;

  @ApiProperty()
  description: string;

  @ApiProperty()
  pattern: string;

  @ApiProperty()
  caseSensitive: boolean;

  @ApiProperty()
  createdAt: Date;

  @ApiProperty()
  updatedAt: Date;
}

import { IsString, IsNotEmpty, IsBoolean, IsInt, IsOptional, Min } from 'class-validator';

export class CreateCheckpointDto {
  @IsString()
  @IsNotEmpty()
  exerciseId: string;

  @IsInt()
  @Min(1)
  order: number;

  @IsString()
  @IsNotEmpty()
  description: string;

  @IsString()
  @IsNotEmpty()
  pattern: string;

  @IsString()
  patternDescription: string;

  @IsString()
  @IsOptional()
  indicatorSolution?: string;

  @IsBoolean()
  @IsOptional()
  caseSensitive?: boolean;
}

export class UpdateCheckpointDto {
  @IsInt()
  @Min(1)
  @IsOptional()
  order?: number;

  @IsString()
  @IsOptional()
  description?: string;

  @IsString()
  @IsOptional()
  pattern?: string;

  @IsString()
  @IsOptional()
  patternDescription?: string;

  @IsString()
  @IsOptional()
  indicatorSolution?: string;

  @IsBoolean()
  @IsOptional()
  caseSensitive?: boolean;
}

export class CheckpointResponseDto {
  id: string;
  exerciseId: string;
  order: number;
  description: string;
  pattern: string;
  patternDescription: string;
  indicatorSolution: string;
  caseSensitive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

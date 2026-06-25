import { IsString, IsNotEmpty, IsOptional, IsEnum } from "class-validator";
import { ExerciseStatus, ExerciseType } from "@prisma/client";

export class CreateExerciseDto {
  @IsString()
  @IsNotEmpty()
  title: string;

  @IsString()
  @IsNotEmpty()
  pdfUrl: string;

  @IsString()
  @IsOptional()
  extractedText?: string;

  @IsEnum(ExerciseType)
  @IsOptional()
  exerciseType?: ExerciseType;
}

export class UpdateExerciseDto {
  @IsString()
  @IsOptional()
  title?: string;

  @IsString()
  @IsOptional()
  pdfUrl?: string;

  @IsEnum(ExerciseStatus)
  @IsOptional()
  status?: ExerciseStatus;
}

export class ExerciseResponseDto {
  id: string;

  title: string;

  originalPdfPath: string;

  // extractedText?: string;

  status: "draft" | "approved";

  exerciseType: "exercise" | "project";

  createdAt: string;

  updatedAt: string;

  checkpointCount?: number;

  submissionCount?: number;
}

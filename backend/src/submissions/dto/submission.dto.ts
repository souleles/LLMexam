import { IsString, IsNotEmpty } from 'class-validator';

export class CreateSubmissionDto {
  @IsString()
  @IsNotEmpty()
  exerciseId: string;

  @IsString()
  @IsNotEmpty()
  fileName: string;

  @IsString()
  @IsNotEmpty()
  fileUrl: string;

  @IsString()
  @IsNotEmpty()
  fileType: string;

  @IsString()
  @IsNotEmpty()
  content: string;
}

export class SubmissionResponseDto {
  id: string;
  exerciseId: string;
  students: Array<{
    studentId: string;
    studentIdentifier: string;
    firstName: string;
    lastName: string;
    email: string | null;
  }>;
  fileName: string;
  fileUrl: string;
  fileType: string;
  content: string;
  createdAt: Date;
  updatedAt: Date;
  gradingResult?: {
    id: string;
    score: number;
    passed: boolean;
    totalCheckpoints: number;
    passedCheckpoints: number;
  };
}

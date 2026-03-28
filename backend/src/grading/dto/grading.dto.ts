import { ApiProperty } from '@nestjs/swagger';

export class GradingResultResponseDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  submissionId: string;

  @ApiProperty()
  totalCheckpoints: number;

  @ApiProperty()
  passedCheckpoints: number;

  @ApiProperty()
  score: number;

  @ApiProperty()
  passed: boolean;

  @ApiProperty()
  gradedAt: Date;

  @ApiProperty()
  checkpointResults: CheckpointResultDto[];
}

export class CheckpointResultDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  submissionId: string;

  @ApiProperty()
  checkpointId: string;

  @ApiProperty()
  matched: boolean;

  @ApiProperty()
  confidence: number;

  @ApiProperty()
  matchedPatterns: string[];

  @ApiProperty()
  matchedSnippets: Array<{
    line: number;
    snippet: string;
  }>;

  @ApiProperty({ required: false })
  checkpoint?: {
    order: number;
    description: string;
    pattern: string;
    caseSensitive: boolean;
  };
}

export class ExerciseGradingResultsDto {
  @ApiProperty()
  exerciseId: string;

  @ApiProperty()
  exerciseTitle: string;

  @ApiProperty()
  totalSubmissions: number;

  @ApiProperty()
  gradedSubmissions: number;

  @ApiProperty()
  averageScore: number;

  @ApiProperty()
  passRate: number;

  @ApiProperty()
  results: StudentGradingResultDto[];
}

export class StudentGradingResultDto {
  @ApiProperty()
  studentName: string;

  @ApiProperty()
  submissionId: string;

  @ApiProperty()
  fileName: string;

  @ApiProperty()
  score: number;

  @ApiProperty()
  passed: boolean;

  @ApiProperty()
  totalCheckpoints: number;

  @ApiProperty()
  passedCheckpoints: number;

  @ApiProperty()
  checkpointResults: CheckpointResultDto[];
}

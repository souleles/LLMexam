export class GradingResultResponseDto {
  id: string;
  submissionId: string;
  totalCheckpoints: number;
  passedCheckpoints: number;
  score: number;
  passed: boolean;
  gradedAt: Date;
  checkpointResults: CheckpointResultDto[];
}

export class CheckpointResultDto {
  id: string;
  submissionId: string;
  checkpointId: string;
  matched: boolean;
  confidence: number;
  matchedPatterns: string[];
  matchedSnippets: Array<{
    line: number;
    snippet: string;
  }>;
  checkpoint?: {
    order: number;
    description: string;
    pattern: string;
    caseSensitive: boolean;
  };
}

export class ExerciseGradingResultsDto {
  exerciseId: string;
  exerciseTitle: string;
  totalSubmissions: number;
  gradedSubmissions: number;
  averageScore: number;
  passRate: number;
  results: StudentGradingResultDto[];
}

export class StudentGradingResultDto {
  studentName: string;
  submissionId: string;
  fileName: string;
  score: number;
  passed: boolean;
  totalCheckpoints: number;
  passedCheckpoints: number;
  checkpointResults: CheckpointResultDto[];
}

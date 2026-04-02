import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import {
  GradingResultResponseDto,
  ExerciseGradingResultsDto,
  CheckpointResultDto,
  StudentGradingResultDto,
  UpdateTeacherScoreDto,
} from './dto/grading.dto';

@Injectable()
export class GradingService {
  constructor(private readonly prisma: PrismaService) {}

  async gradeSubmission(submissionId: string): Promise<GradingResultResponseDto> {
    // Get submission with exercise and checkpoints
    const submission = await this.prisma.submission.findUnique({
      where: { id: submissionId },
      include: {
        exercise: {
          include: {
            checkpoints: {
              orderBy: { order: 'asc' },
            },
          },
        },
      },
    });

    if (!submission) {
      throw new NotFoundException(`Submission with ID ${submissionId} not found`);
    }

    if (submission.exercise.checkpoints.length === 0) {
      throw new BadRequestException('Exercise has no checkpoints to grade against');
    }

    const content = submission.content;
    const checkpoints = submission.exercise.checkpoints;

    // Grade each checkpoint using deterministic regex matching
    const checkpointResults = checkpoints.map((checkpoint) => {
      const flags = checkpoint.caseSensitive ? 'g' : 'gi';
      const regex = new RegExp(checkpoint.pattern, flags);
      const matches = content.match(regex) || [];
      const matched = matches.length > 0;

      return {
        checkpointId: checkpoint.id,
        matched,
        matchedSnippets: matches.slice(0, 5), // Limit to first 5 matches
        checkpoint: {
          order: checkpoint.order,
          description: checkpoint.description,
          pattern: checkpoint.pattern,
          caseSensitive: checkpoint.caseSensitive,
        },
      };
    });

    const passedCheckpoints = checkpointResults.filter((r) => r.matched).length;
    const totalCheckpoints = checkpoints.length;
    const score = (passedCheckpoints / totalCheckpoints) * 100;
    const passed = score >= 50; // Pass threshold: 50%

    // Delete existing grading result if any
    await this.prisma.gradingResult.deleteMany({
      where: { submissionId },
    });

    // Create new grading result
    const gradingResult = await this.prisma.gradingResult.create({
      data: {
        submissionId,
        totalCheckpoints,
        passedCheckpoints,
        score,
        passed,
        checkpointResults: {
          create: checkpointResults.map((cr) => ({
            checkpointId: cr.checkpointId,
            matched: cr.matched,
            matchedSnippets: cr.matchedSnippets,
          })),
        },
      },
      include: {
        checkpointResults: {
          include: {
            checkpoint: true,
          },
        },
      },
    });

    return this.mapToResponseDto(gradingResult);
  }

  async gradeAllSubmissions(exerciseId: string): Promise<ExerciseGradingResultsDto> {
    // Verify exercise exists
    const exercise = await this.prisma.exercise.findUnique({
      where: { id: exerciseId },
      include: {
        submissions: true,
        checkpoints: true,
      },
    });

    if (!exercise) {
      throw new NotFoundException(`Exercise with ID ${exerciseId} not found`);
    }

    if (exercise.checkpoints.length === 0) {
      throw new BadRequestException('Exercise has no checkpoints to grade against');
    }

    // Grade each submission
    const gradingPromises = exercise.submissions.map((submission) =>
      this.gradeSubmission(submission.id),
    );

    await Promise.all(gradingPromises);

    // Get all grading results
    return this.getExerciseResults(exerciseId);
  }

  async getExerciseResults(exerciseId: string): Promise<ExerciseGradingResultsDto> {
    const exercise = await this.prisma.exercise.findUnique({
      where: { id: exerciseId },
      include: {
        submissions: {
          include: {
            submissionStudents: { include: { student: true } },
            gradingResult: {
              include: {
                checkpointResults: {
                  include: {
                    checkpoint: true,
                  },
                },
              },
            },
          },
        },
      },
    });

    if (!exercise) {
      throw new NotFoundException(`Exercise with ID ${exerciseId} not found`);
    }

    const gradedSubmissions = exercise.submissions.filter((s) => s.gradingResult);
    const totalSubmissions = exercise.submissions.length;

    let totalScore = 0;
    let passedCount = 0;    
    const results: StudentGradingResultDto[] = gradedSubmissions.map((submission) => {
      const result = submission.gradingResult!;
      totalScore += result.score;
      if (result.passed) passedCount++;

      return {
        students: submission.submissionStudents.map((ss: any) => ({
          studentIdentifier: ss.student.studentIdentifier,
          firstName: ss.student.firstName,
          lastName: ss.student.lastName,
        })),
        submissionId: submission.id,
        fileName: submission.fileName,
        score: result.score,
        passed: result.passed,
        totalCheckpoints: result.totalCheckpoints,
        passedCheckpoints: result.passedCheckpoints,
        checkpointResults: result.checkpointResults.map((cr: any) => ({
          id: cr.id,
          submissionId: submission.id,
          checkpointId: cr.checkpointId,
          matched: cr.matched,
          confidence: cr.matched ? 1.0 : 0.0,
          matchedPatterns: cr.matched ? [cr.checkpoint.pattern] : [],
          matchedSnippets: (cr.matchedSnippets as any[]).map((snippet: any, idx: number) =>
            typeof snippet === 'string' ? { line: idx + 1, snippet } : snippet
          ),
          checkpoint: {
            order: cr.checkpoint.order,
            description: cr.checkpoint.description,
            pattern: cr.checkpoint.pattern,
            caseSensitive: cr.checkpoint.caseSensitive,
          },
        })),
      };
    });

    const averageScore = gradedSubmissions.length > 0 ? totalScore / gradedSubmissions.length : 0;
    const passRate = gradedSubmissions.length > 0 ? (passedCount / gradedSubmissions.length) * 100 : 0;

    return {
      exerciseId: exercise.id,
      exerciseTitle: exercise.title,
      totalSubmissions,
      gradedSubmissions: gradedSubmissions.length,
      averageScore,
      passRate,
      results,
    };
  }

  async getSubmissionResult(submissionId: string): Promise<GradingResultResponseDto> {
    const gradingResult = await this.prisma.gradingResult.findUnique({
      where: { submissionId },
      include: {
        checkpointResults: {
          include: {
            checkpoint: true,
          },
        },
      },
    });

    if (!gradingResult) {
      throw new NotFoundException(`Grading result for submission ${submissionId} not found`);
    }

    return this.mapToResponseDto(gradingResult);
  }  async gradeSubmissionDetailed(submissionId: string): Promise<CheckpointResultDto[]> {
    // Grade the submission first
    const result = await this.gradeSubmission(submissionId);
    
    // Return just the checkpoint results array with enhanced format
    return result.checkpointResults.map((cr) => ({
      id: cr.id,
      submissionId: submissionId,
      checkpointId: cr.checkpointId,
      matched: cr.matched,
      confidence: cr.matched ? 1.0 : 0.0,
      matchedPatterns: cr.matched && cr.checkpoint ? [cr.checkpoint.pattern] : [],
      matchedSnippets: (cr.matchedSnippets as any).map((snippet: any, idx: number) => 
        typeof snippet === 'string' ? { line: idx + 1, snippet } : snippet
      ),
      checkpoint: cr.checkpoint,
    }));
  }

  async getAllResults(exerciseId: string): Promise<CheckpointResultDto[]> {
    const results = await this.prisma.checkpointResult.findMany({
      where: {
        gradingResult: {
          submission: {
            exerciseId,
          },
        },
      },
      include: {
        checkpoint: true,
        gradingResult: true,
      },
    });

    return results.map((cr) => ({
      id: cr.id,
      submissionId: cr.gradingResult.submissionId,
      checkpointId: cr.checkpointId,
      matched: cr.matched,
      confidence: cr.matched ? 1.0 : 0.0,
      matchedPatterns: cr.matched ? [cr.checkpoint.pattern] : [],
      matchedSnippets: cr.matchedSnippets.map((snippet, idx) => ({
        line: idx + 1,
        snippet: snippet,
      })),
      checkpoint: {
        order: cr.checkpoint.order,
        description: cr.checkpoint.description,
        pattern: cr.checkpoint.pattern,
        caseSensitive: cr.checkpoint.caseSensitive,
      },
    }));
  }
  async saveResults(results: CheckpointResultDto[]): Promise<void> {
    // This is a bulk save operation for manually adjusted results
    // For now, we'll update existing checkpoint results
    await Promise.all(
      results.map((result) => {
        // Extract just the snippet strings from the enhanced format
        const snippets = result.matchedSnippets.map(ms => ms.snippet);
        
        return this.prisma.checkpointResult.update({
          where: { id: result.id },
          data: {
            matched: result.matched,
            matchedSnippets: snippets,
          },
        });
      })
    );
  }

  async updateTeacherScore(submissionId: string, dto: UpdateTeacherScoreDto): Promise<GradingResultResponseDto> {
    // Find the grading result for this submission
    const gradingResult = await this.prisma.gradingResult.findUnique({
      where: { submissionId },
      include: {
        checkpointResults: {
          include: {
            checkpoint: true,
          },
        },
      },
    });

    if (!gradingResult) {
      throw new NotFoundException(`Grading result for submission ${submissionId} not found`);
    }

    // Update the teacher score
    const updated = await this.prisma.gradingResult.update({
      where: { id: gradingResult.id },
      data: { teacherScore: dto.teacherScore },
      include: {
        checkpointResults: {
          include: {
            checkpoint: true,
          },
        },
      },
    });

    return this.mapToResponseDto(updated);
  }
  private mapToResponseDto(gradingResult: any): GradingResultResponseDto {
    return {
      id: gradingResult.id,
      submissionId: gradingResult.submissionId,
      totalCheckpoints: gradingResult.totalCheckpoints,
      passedCheckpoints: gradingResult.passedCheckpoints,
      score: gradingResult.score,
      teacherScore: gradingResult.teacherScore,
      passed: gradingResult.passed,
      gradedAt: gradingResult.gradedAt,
      checkpointResults: gradingResult.checkpointResults.map((cr: any) => ({
        id: cr.id,
        submissionId: gradingResult.submissionId,
        checkpointId: cr.checkpointId,
        matched: cr.matched,
        confidence: cr.matched ? 1.0 : 0.0,
        matchedPatterns: cr.matched ? [cr.checkpoint.pattern] : [],
        matchedSnippets: (cr.matchedSnippets as any[]).map((snippet: any, idx: number) =>
          typeof snippet === 'string' ? { line: idx + 1, snippet } : snippet
        ),
        checkpoint: {
          order: cr.checkpoint.order,
          description: cr.checkpoint.description,
          pattern: cr.checkpoint.pattern,
          caseSensitive: cr.checkpoint.caseSensitive,
        },
      })),
    };
  }
}

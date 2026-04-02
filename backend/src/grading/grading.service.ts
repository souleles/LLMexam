import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import {
  GradingResultResponseDto,
  CheckpointResultDto,
  UpdateTeacherScoreDto,
} from './dto/grading.dto';

@Injectable()
export class GradingService {
  constructor(private readonly prisma: PrismaService) {}

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

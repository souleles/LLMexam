import { Injectable, NotFoundException, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import {
  GradingResultResponseDto,
  CheckpointResultDto,
  UpdateTeacherScoreDto,
} from './dto/grading.dto';

/** Parse a stored matchedSnippet string back to {file, line, snippet}. */
function parseSnippet(raw: string): { file?: string; line: number; snippet: string } {
  try {
    const parsed = JSON.parse(raw);
    if (typeof parsed === 'object' && parsed !== null && 'line' in parsed) {
      return { file: parsed.file, line: Number(parsed.line), snippet: String(parsed.snippet ?? '') };
    }
  } catch {
    // Fall through to legacy format handling
  }
  // Legacy format: "file.sql:42 - snippet text"
  const legacyMatch = raw.match(/^(.+):(\d+) - (.*)$/s);
  if (legacyMatch) {
    return { file: legacyMatch[1], line: Number(legacyMatch[2]), snippet: legacyMatch[3] };
  }
  return { line: 0, snippet: raw };
}

@Injectable()
export class GradingService {
  private readonly logger = new Logger(GradingService.name);

  constructor(private readonly prisma: PrismaService) {}

  async getAllResults(exerciseId: string): Promise<CheckpointResultDto[]> {
    this.logger.log(`Loading all grading results for exercise ${exerciseId}`);
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

    this.logger.log(`Found ${results.length} checkpoint result(s) for exercise ${exerciseId}`);
    return results.map((cr) => {
      const matchedSnippets = cr.matchedSnippets.map((raw) => {
        const parsed = parseSnippet(raw);
        this.logger.debug(
          `Checkpoint ${cr.checkpointId} snippet -> file=${parsed.file ?? '?'}, line=${parsed.line}, snippet=${parsed.snippet.slice(0, 80)}`,
        );
        return parsed;
      });
      return {
        id: cr.id,
        submissionId: cr.gradingResult.submissionId,
        checkpointId: cr.checkpointId,
        matched: cr.matched,
        confidence: cr.matched ? 1.0 : 0.0,
        matchedPatterns: cr.matched ? [cr.checkpoint.pattern] : [],
        matchedSnippets,
        checkpoint: {
          order: cr.checkpoint.order,
          description: cr.checkpoint.description,
          pattern: cr.checkpoint.pattern,
          caseSensitive: cr.checkpoint.caseSensitive,
        },
      };
    });
  }
  async saveResults(results: CheckpointResultDto[]): Promise<void> {
    this.logger.log(`Saving ${results.length} checkpoint result(s)`);
    await Promise.all(
      results.map((result) => {
        const matchedSnippets = result.matchedSnippets.map((ms) =>
          JSON.stringify({ file: ms.file, line: ms.line, snippet: ms.snippet }),
        );
        this.logger.debug(
          `Saving checkpoint result ${result.id}: matched=${result.matched}, snippets=${matchedSnippets.length}`,
        );
        return this.prisma.checkpointResult.update({
          where: { id: result.id },
          data: {
            matched: result.matched,
            matchedSnippets,
          },
        });
      }),
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
      gradedAt: gradingResult.gradedAt,
      checkpointResults: gradingResult.checkpointResults.map((cr: any) => ({
        id: cr.id,
        submissionId: gradingResult.submissionId,
        checkpointId: cr.checkpointId,
        matched: cr.matched,
        confidence: cr.matched ? 1.0 : 0.0,
        matchedPatterns: cr.matched ? [cr.checkpoint.pattern] : [],
        matchedSnippets: (cr.matchedSnippets as string[]).map((raw) => parseSnippet(raw)),
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

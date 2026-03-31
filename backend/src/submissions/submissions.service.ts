import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { SubmissionResponseDto } from './dto/submission.dto';
import * as AdmZip from 'adm-zip';
import * as fs from 'fs';
import * as path from 'path';

const ALLOWED_EXTENSIONS = ['.sql', '.txt', '.py', '.js', '.ts', '.tsx', '.jsx', '.java', '.c', '.cpp', '.cs', '.php', '.rb', '.go'];

export interface CheckpointMatch {
  checkpointId: string;
  checkpointDescription: string;
  matched: boolean;
  matchedSnippets: Array<{
    file: string;
    line: number;
    snippet: string;
  }>;
}

@Injectable()
export class SubmissionsService {
  constructor(
    private readonly prisma: PrismaService,
  ) {}

  async uploadAndGradeZip(
    exerciseId: string,
    studentIdentifier: string,
    studentName: string,
    file: Express.Multer.File,
  ): Promise<CheckpointMatch[]> {
    // 1. Verify exercise exists and is approved
    const exercise = await this.prisma.exercise.findUnique({
      where: { id: exerciseId },
      include: {
        checkpoints: {
          orderBy: { order: 'asc' },
        },
      },
    });

    if (!exercise) {
      throw new NotFoundException(`Exercise with ID ${exerciseId} not found`);
    }

    if (exercise.status !== 'APPROVED') {
      throw new BadRequestException('Exercise must be approved before accepting submissions');
    }

    if (exercise.checkpoints.length === 0) {
      throw new BadRequestException('Exercise has no checkpoints defined');
    }

    // 2. Extract ZIP file
    let extractedFiles: Array<{ relativePath: string; content: string }> = [];
    
    try {
      if (file.originalname.endsWith('.zip')) {
        const zip = new AdmZip(file.path);
        const zipEntries = zip.getEntries();

        for (const entry of zipEntries) {
          if (entry.isDirectory) continue;

          const ext = path.extname(entry.entryName).toLowerCase();
          if (!ALLOWED_EXTENSIONS.includes(ext)) continue;

          const content = entry.getData().toString('utf8');
          extractedFiles.push({
            relativePath: entry.entryName,
            content,
          });
        }
      } else {
        // Single file upload (not zip)
        const ext = path.extname(file.originalname).toLowerCase();
        if (!ALLOWED_EXTENSIONS.includes(ext)) {
          throw new BadRequestException(`File type ${ext} is not allowed`);
        }

        const content = fs.readFileSync(file.path, 'utf8');
        extractedFiles.push({
          relativePath: file.originalname,
          content,
        });
      }
    } catch (error) {
      throw new BadRequestException(`Failed to extract files: ${error.message}`);
    } finally {
      // Clean up uploaded file
      try {
        fs.unlinkSync(file.path);
      } catch (err) {
        console.error('Failed to delete uploaded file:', err);
      }
    }

    if (extractedFiles.length === 0) {
      throw new BadRequestException('No valid files found in the uploaded ZIP');
    }

    // 3. Combine all file contents for submission storage
    const combinedContent = extractedFiles
      .map(f => `// File: ${f.relativePath}\n${f.content}`)
      .join('\n\n');

    // 4. Create submission record
    const submission = await this.prisma.submission.create({
      data: {
        exerciseId,
        studentIdentifier,
        studentName,
        fileName: file.originalname,
        fileUrl: `/uploads/submissions/${file.filename}`,
        fileType: path.extname(file.originalname),
        content: combinedContent,
      },
    });

    // 5. Perform regex matching for each checkpoint
    const checkpointMatches: CheckpointMatch[] = [];

    for (const checkpoint of exercise.checkpoints) {
      const match: CheckpointMatch = {
        checkpointId: checkpoint.id,
        checkpointDescription: checkpoint.description,
        matched: false,
        matchedSnippets: [],
      };

      if (!checkpoint.pattern || checkpoint.pattern.trim() === '') {
        checkpointMatches.push(match);
        continue;
      }

      try {
        const flags = checkpoint.caseSensitive ? 'g' : 'gi';
        const regex = new RegExp(checkpoint.pattern, flags);

        // Search in all extracted files
        for (const file of extractedFiles) {
          const lines = file.content.split('\n');
          
          lines.forEach((line, index) => {
            if (regex.test(line)) {
              match.matched = true;
              match.matchedSnippets.push({
                file: file.relativePath,
                line: index + 1,
                snippet: line.trim(),
              });
            }
          });
        }
      } catch (error) {
        console.error(`Invalid regex pattern for checkpoint ${checkpoint.id}:`, error.message);
        // Continue with other checkpoints
      }

      checkpointMatches.push(match);
    }

    // 6. Save grading results to database
    const passedCheckpoints = checkpointMatches.filter(m => m.matched).length;
    const totalCheckpoints = checkpointMatches.length;
    const score = (passedCheckpoints / totalCheckpoints) * 100;
    const passed = score >= 50; // 50% threshold

    await this.prisma.gradingResult.create({
      data: {
        submissionId: submission.id,
        totalCheckpoints,
        passedCheckpoints,
        score,
        passed,
        checkpointResults: {
          create: checkpointMatches.map(match => ({
            checkpointId: match.checkpointId,
            matched: match.matched,
            matchedSnippets: match.matchedSnippets.map(s => `${s.file}:${s.line} - ${s.snippet}`),
          })),
        },
      },
    });

    // 7. Return the checkpoint matches    
    return checkpointMatches;
  }

  async findByExercise(exerciseId: string): Promise<SubmissionResponseDto[]> {
    const submissions = await this.prisma.submission.findMany({
      where: { exerciseId },
      include: {
        gradingResult: true,
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    return submissions.map((submission) => this.mapToResponseDto(submission));
  }

  async findAll(): Promise<SubmissionResponseDto[]> {
    const submissions = await this.prisma.submission.findMany({
      include: {
        gradingResult: true,
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    return submissions.map(s => this.mapToResponseDto(s));
  }

  async findOne(id: string): Promise<SubmissionResponseDto> {
    const submission = await this.prisma.submission.findUnique({
      where: { id },
      include: {
        gradingResult: true,
      },
    });

    if (!submission) {
      throw new NotFoundException(`Submission with ID ${id} not found`);
    }

    return this.mapToResponseDto(submission);
  }

  async remove(id: string): Promise<void> {
    try {
      await this.prisma.submission.delete({
        where: { id },
      });
    } catch (error) {
      throw new NotFoundException(`Submission with ID ${id} not found`);
    }
  }

  private mapToResponseDto(submission: any): SubmissionResponseDto {
    const response: SubmissionResponseDto = {
      id: submission.id,
      exerciseId: submission.exerciseId,
      studentIdentifier: submission.studentIdentifier,
      studentName: submission.studentName,
      fileName: submission.fileName,
      fileUrl: submission.fileUrl,
      fileType: submission.fileType,
      content: submission.content,
      createdAt: submission.createdAt,
      updatedAt: submission.updatedAt,
    };

    if (submission.gradingResult) {
      response.gradingResult = {
        id: submission.gradingResult.id,
        score: submission.gradingResult.score,
        passed: submission.gradingResult.passed,
        totalCheckpoints: submission.gradingResult.totalCheckpoints,
        passedCheckpoints: submission.gradingResult.passedCheckpoints,
      };
    }

    return response;
  }
}

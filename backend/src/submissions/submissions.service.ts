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

export interface UploadAndGradeResult {
  submissionId: string;
  checkpoints: CheckpointMatch[];
}

const SUBMISSION_INCLUDE = {
  submissionStudents: {
    include: { student: true },
  },
  gradingResult: true,
} as const;

@Injectable()
export class SubmissionsService {
  constructor(private readonly prisma: PrismaService) {}

  async uploadAndGradeZip(
    exerciseId: string,
    studentIds: string[],
    file: Express.Multer.File,
  ): Promise<{ checkpoints: CheckpointMatch[]; submissionId: string }> {
    // 1. Verify exercise exists and is approved
    const exercise = await this.prisma.exercise.findUnique({
      where: { id: exerciseId },
      include: { checkpoints: { orderBy: { order: 'asc' } } },
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

    // 2. Verify all students exist
    const students = await this.prisma.student.findMany({
      where: { id: { in: studentIds } },
      orderBy: [{ lastName: 'asc' }, { firstName: 'asc' }],
    });
    if (students.length !== studentIds.length) {
      throw new BadRequestException('One or more student IDs are invalid');
    }

    // 3. Check for existing submissions for these students in this exercise
    const existingSubmissionStudents = await this.prisma.submissionStudent.findMany({
      where: {
        studentId: { in: studentIds },
        submission: { exerciseId },
      },
      include: {
        submission: true,
        student: true,
      },
    });

    let existingSubmissionId: string | null = null;

    if (existingSubmissionStudents.length > 0) {
      // Group by submission ID
      const submissionGroups = new Map<string, string[]>();
      existingSubmissionStudents.forEach((ss) => {
        if (!submissionGroups.has(ss.submissionId)) {
          submissionGroups.set(ss.submissionId, []);
        }
        submissionGroups.get(ss.submissionId)!.push(ss.studentId);
      });

      // Check if all requested students belong to the SAME submission
      if (submissionGroups.size === 1) {
        const [submissionId, requestedStudentsInSubmission] = Array.from(submissionGroups.entries())[0];
        
        // Fetch ALL students in that submission (not just the requested ones)
        const allStudentsInSubmission = await this.prisma.submissionStudent.findMany({
          where: { submissionId },
          select: { studentId: true },
        });
        
        const allStudentIdsInSubmission = allStudentsInSubmission.map(ss => ss.studentId);
        
        // Check if EXACTLY the same group of students
        const requestedStudentIdsSet = new Set(studentIds);
        const existingStudentIdsSet = new Set(allStudentIdsInSubmission);
        
        const sameStudents = 
          requestedStudentIdsSet.size === existingStudentIdsSet.size &&
          [...requestedStudentIdsSet].every(id => existingStudentIdsSet.has(id));

        if (sameStudents) {
          // Exact same group - allow update
          existingSubmissionId = submissionId;
        } else {
          // Different group composition - reject
          const studentsWithSubmissions = existingSubmissionStudents.map(
            (ss) => `${ss.student.lastName} ${ss.student.firstName} (${ss.student.studentIdentifier})`,
          );
          throw new BadRequestException(
            `Έχει ήδη υποβληθεί άσκηση για τον/τους μαθητή/ές: ${studentsWithSubmissions.join(', ')}. ` +
            `Δεν μπορείτε να αλλάξετε την ομάδα μετά την υποβολή.`,
          );
        }
      } else {
        // Students belong to DIFFERENT submissions - reject
        const studentsWithSubmissions = existingSubmissionStudents.map(
          (ss) => `${ss.student.lastName} ${ss.student.firstName} (${ss.student.studentIdentifier})`,
        );
        throw new BadRequestException(
          `Έχει ήδη υποβληθεί άσκηση για τον/τους μαθητή/ές: ${studentsWithSubmissions.join(', ')}`,
        );
      }
    }

    // 4. Extract file contents
    let extractedFiles: Array<{ relativePath: string; content: string }> = [];

    try {
      if (file.originalname.endsWith('.zip')) {
        const zip = new AdmZip(file.path);
        for (const entry of zip.getEntries()) {
          if (entry.isDirectory) continue;
          const ext = path.extname(entry.entryName).toLowerCase();
          if (!ALLOWED_EXTENSIONS.includes(ext)) continue;
          extractedFiles.push({
            relativePath: entry.entryName,
            content: entry.getData().toString('utf8'),
          });
        }
      } else {
        const ext = path.extname(file.originalname).toLowerCase();
        if (!ALLOWED_EXTENSIONS.includes(ext)) {
          throw new BadRequestException(`File type ${ext} is not allowed`);
        }
        extractedFiles.push({
          relativePath: file.originalname,
          content: fs.readFileSync(file.path, 'utf8'),
        });
      }
    } catch (error) {
      throw new BadRequestException(`Failed to extract files: ${error.message}`);
    } finally {
      try { fs.unlinkSync(file.path); } catch { /* ignore */ }
    }

    if (extractedFiles.length === 0) {
      throw new BadRequestException('No valid files found in the uploaded ZIP');
    }

    const combinedContent = extractedFiles
      .map(f => `// File: ${f.relativePath}\n${f.content}`)
      .join('\n\n');

    // 5. Create or update submission
    let submission: any;
    
    if (existingSubmissionId) {
      // Update existing submission
      submission = await this.prisma.submission.update({
        where: { id: existingSubmissionId },
        data: {
          fileName: file.originalname,
          fileUrl: `/uploads/submissions/${file.filename}`,
          fileType: path.extname(file.originalname),
          content: combinedContent,
          updatedAt: new Date(),
        },
      });

      // Delete old grading results and checkpoint results
      await this.prisma.gradingResult.deleteMany({
        where: { submissionId: existingSubmissionId },
      });
    } else {
      // Create new submission
      submission = await this.prisma.submission.create({
        data: {
          exerciseId,
          fileName: file.originalname,
          fileUrl: `/uploads/submissions/${file.filename}`,
          fileType: path.extname(file.originalname),
          content: combinedContent,
        },
      });

      // Create mapping rows for all selected students
      await this.prisma.submissionStudent.createMany({
        data: studentIds.map((studentId) => ({ submissionId: submission.id, studentId })),
        skipDuplicates: true,
      });
    }

    // 6. Regex matching for each checkpoint
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

        for (const f of extractedFiles) {
          f.content.split('\n').forEach((line, index) => {
            if (regex.test(line)) {
              match.matched = true;
              match.matchedSnippets.push({ file: f.relativePath, line: index + 1, snippet: line.trim() });
            }
          });
        }
      } catch (error) {
        console.error(`Invalid regex pattern for checkpoint ${checkpoint.id}:`, error.message);
      }

      checkpointMatches.push(match);
    }

    // 7. Save grading result
    const passedCheckpoints = checkpointMatches.filter(m => m.matched).length;
    const totalCheckpoints = checkpointMatches.length;
    const score = (passedCheckpoints / totalCheckpoints) * 100;

    const gradingResult = await this.prisma.gradingResult.upsert({
      where: { submissionId: submission.id },
      create: {
        submission: { connect: { id: submission.id } },
        totalCheckpoints,
        passedCheckpoints,
        score,
        passed: score >= 50,
      },
      update: { totalCheckpoints, passedCheckpoints, score, passed: score >= 50 },
    });

    await this.prisma.checkpointResult.createMany({
      data: checkpointMatches.map(match => ({
        gradingResultId: gradingResult.id,
        checkpointId: match.checkpointId,
        matched: match.matched,
        matchedSnippets: match.matchedSnippets.map(s => `${s.file}:${s.line} - ${s.snippet}`),
      })),
    });

    return {
      checkpoints: checkpointMatches,
      submissionId: submission.id
    };
  }

  async findByExercise(exerciseId: string): Promise<SubmissionResponseDto[]> {
    const submissions = await this.prisma.submission.findMany({
      where: { exerciseId },
      include: SUBMISSION_INCLUDE,
      orderBy: { createdAt: 'desc' },
    });
    return submissions.map(this.mapToResponseDto);
  }

  async findAll(): Promise<SubmissionResponseDto[]> {
    const submissions = await this.prisma.submission.findMany({
      include: SUBMISSION_INCLUDE,
      orderBy: { createdAt: 'desc' },
    });
    return submissions.map(this.mapToResponseDto);
  }

  async findOne(id: string): Promise<SubmissionResponseDto> {
    const submission = await this.prisma.submission.findUnique({
      where: { id },
      include: SUBMISSION_INCLUDE,
    });
    if (!submission) {
      throw new NotFoundException(`Submission with ID ${id} not found`);
    }
    return this.mapToResponseDto(submission);
  }

  async remove(id: string): Promise<void> {
    try {
      await this.prisma.submission.delete({ where: { id } });
    } catch {
      throw new NotFoundException(`Submission with ID ${id} not found`);
    }
  }

  private mapToResponseDto(submission: any): SubmissionResponseDto {
    const dto: SubmissionResponseDto = {
      id: submission.id,
      exerciseId: submission.exerciseId,
      students: (submission.submissionStudents ?? []).map((ss: any) => ({
        studentId: ss.student.id,
        studentIdentifier: ss.student.studentIdentifier,
        firstName: ss.student.firstName,
        lastName: ss.student.lastName,
        email: ss.student.email,
      })),
      fileName: submission.fileName,
      fileUrl: submission.fileUrl,
      fileType: submission.fileType,
      content: submission.content,
      createdAt: submission.createdAt,
      updatedAt: submission.updatedAt,
    };

    if (submission.gradingResult) {
      dto.gradingResult = {
        id: submission.gradingResult.id,
        score: submission.gradingResult.score,
        passed: submission.gradingResult.passed,
        totalCheckpoints: submission.gradingResult.totalCheckpoints,
        passedCheckpoints: submission.gradingResult.passedCheckpoints,
      };
    }

    return dto;
  }
}

import { Injectable, NotFoundException, BadRequestException, Logger } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { SubmissionResponseDto } from './dto/submission.dto';
import * as AdmZip from 'adm-zip';
import * as fs from 'fs';
import * as path from 'path';
import { firstValueFrom } from 'rxjs';
import * as FormData from 'form-data';

const ALLOWED_EXTENSIONS = ['.sql', '.txt', '.py', '.js', '.ts', '.tsx', '.jsx', '.java', '.c', '.cpp', '.cs', '.php', '.rb', '.go', '.pdf'];

// Multer (busboy) and adm-zip both decode non-ASCII bytes as Latin-1 when the
// UTF-8 encoding flag is absent. If those bytes were actually UTF-8 (common with
// Greek filenames on Windows), re-interpreting Latin-1 → raw bytes → UTF-8 restores
// the original string. Falls back to the original when the bytes are not valid UTF-8.
function decodeFilename(name: string): string {
  try {
    const decoded = Buffer.from(name, 'latin1').toString('utf8');
    return decoded.includes('�') ? name : decoded;
  } catch {
    return name;
  }
}

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
  method: 'regex' | 'llm';
}

const SUBMISSION_INCLUDE = {
  submissionStudents: {
    include: { student: true },
  },
  gradingResult: true,
} as const;

@Injectable()
export class SubmissionsService {
  private readonly pythonServiceUrl: string;
  private readonly logger = new Logger(SubmissionsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly httpService: HttpService,
    private readonly configService: ConfigService,
  ) {
    this.pythonServiceUrl = this.configService.get('PYTHON_SERVICE_URL', 'http://localhost:8000');
  }

  async uploadAndGradeZip(
    exerciseId: string,
    studentIds: string[],
    file: Express.Multer.File,
    method: 'regex' | 'llm' = 'regex',
  ): Promise<{ checkpoints: CheckpointMatch[]; submissionId: string; method: 'regex' | 'llm' }> {
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
        const [submissionId] = Array.from(submissionGroups.entries())[0];
        
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
          const entryName = decodeFilename(entry.entryName);
          if (ext === '.pdf') {
            const text = await this.extractPdfContent(entry.getData(), entryName);
            if (text !== null) {
              extractedFiles.push({ relativePath: entryName, content: text });
            }
          } else {
            extractedFiles.push({
              relativePath: entryName,
              content: entry.getData().toString('utf8'),
            });
          }
        }
      } else {
        const ext = path.extname(file.originalname).toLowerCase();
        if (!ALLOWED_EXTENSIONS.includes(ext)) {
          throw new BadRequestException(`File type ${ext} is not allowed`);
        }
        const originalName = decodeFilename(file.originalname);
        if (ext === '.pdf') {
          const text = await this.extractPdfContent(fs.readFileSync(file.path), originalName);
          if (text !== null) {
            extractedFiles.push({ relativePath: originalName, content: text });
          }
        } else {
          extractedFiles.push({
            relativePath: originalName,
            content: fs.readFileSync(file.path, 'utf8'),
          });
        }
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

      // Regex re-grade: clear old results so createMany works cleanly (original behaviour)
      if (method === 'regex') {
        await this.prisma.gradingResult.deleteMany({
          where: { submissionId: existingSubmissionId },
        });
      }
    } else {
      submission = await this.prisma.submission.create({
        data: {
          exerciseId,
          fileName: file.originalname,
          fileUrl: `/uploads/submissions/${file.filename}`,
          fileType: path.extname(file.originalname),
          content: combinedContent,
        },
      });

      await this.prisma.submissionStudent.createMany({
        data: studentIds.map((studentId) => ({ submissionId: submission.id, studentId })),
        skipDuplicates: true,
      });
    }

    // 6. Grade via Python service — regex uses /grade, LLM uses /grade-llm
    const pythonEndpoint = method === 'llm' ? '/grade-llm' : '/grade';
    this.logger.log(
      `Sending grading request [${method}]: ${exercise.checkpoints.length} checkpoints, ${extractedFiles.length} files`,
    );

    const gradeResponse = await firstValueFrom(
      this.httpService.post(`${this.pythonServiceUrl}${pythonEndpoint}`, {
        checkpoints: exercise.checkpoints.map((cp) => ({
          id: cp.id,
          description: cp.description,
          pattern: cp.pattern,
          case_sensitive: cp.caseSensitive,
        })),
        files: extractedFiles.map((f) => ({
          relative_path: f.relativePath,
          content: f.content,
        })),
      }),
    );

    const checkpointMatches: CheckpointMatch[] = gradeResponse.data.results.map((r: any) => {
      const cp = exercise.checkpoints.find((c) => c.id === r.checkpoint_id)!;
      this.logger.debug(
        `Checkpoint "${cp.description}" (${r.checkpoint_id}): matched=${r.matched}, snippets=${r.matched_snippets?.length ?? 0}`,
      );
      for (const s of r.matched_snippets ?? []) {
        this.logger.debug(`  -> ${s.file}:${s.line} | ${String(s.snippet).slice(0, 120)}`);
      }
      return {
        checkpointId: r.checkpoint_id,
        checkpointDescription: cp.description,
        matched: r.matched,
        matchedSnippets: r.matched_snippets,
      };
    });

    const passed = checkpointMatches.filter((m) => m.matched).length;
    const totalCheckpoints = checkpointMatches.length;
    this.logger.log(`Grading result [${method}]: ${passed}/${totalCheckpoints} checkpoints passed`);

    if (method === 'regex') {
      // --- REGEX: original save logic, untouched ---
      const score = (passed / totalCheckpoints) * 100;

      const gradingResult = await this.prisma.gradingResult.upsert({
        where: { submissionId: submission.id },
        create: {
          submission: { connect: { id: submission.id } },
          totalCheckpoints,
          passedCheckpoints: passed,
          score,
        },
        update: { totalCheckpoints, passedCheckpoints: passed, score },
      });

      await this.prisma.checkpointResult.createMany({
        data: checkpointMatches.map((match) => ({
          gradingResultId: gradingResult.id,
          checkpointId: match.checkpointId,
          matched: match.matched,
          matchedSnippets: match.matchedSnippets.map((s) =>
            JSON.stringify({ file: s.file, line: s.line, snippet: s.snippet }),
          ),
        })),
      });
      this.logger.log(`Saved regex grading result ${gradingResult.id} for submission ${submission.id}`);
    } else {
      // --- LLM: upsert GradingResult (llm columns), update existing CheckpointResults or create ---
      // Cast to any because Prisma client types are regenerated only after `prisma generate`.
      const db = this.prisma as any;
      const llmScore = (passed / totalCheckpoints) * 100;

      const gradingResult = await db.gradingResult.upsert({
        where: { submissionId: submission.id },
        create: {
          submission: { connect: { id: submission.id } },
          totalCheckpoints,
          passedCheckpoints: 0,
          score: 0,
          llmPassedCheckpoints: passed,
          llmScore,
        },
        update: { totalCheckpoints, llmPassedCheckpoints: passed, llmScore },
      });

      // Find any existing CheckpointResults for this GradingResult (from a prior regex run)
      const existingCRs: Array<{ id: string; checkpointId: string }> =
        await this.prisma.checkpointResult.findMany({
          where: { gradingResultId: gradingResult.id },
          select: { id: true, checkpointId: true },
        });

      for (const match of checkpointMatches) {
        const snippetsJson = match.matchedSnippets.map((s) =>
          JSON.stringify({ file: s.file, line: s.line, snippet: s.snippet }),
        );
        const existing = existingCRs.find((r) => r.checkpointId === match.checkpointId);

        if (existing) {
          await db.checkpointResult.update({
            where: { id: existing.id },
            data: { llmMatched: match.matched, llmMatchedSnippets: snippetsJson },
          });
        } else {
          await db.checkpointResult.create({
            data: {
              gradingResultId: gradingResult.id,
              checkpointId: match.checkpointId,
              matched: false,
              matchedSnippets: [],
              llmMatched: match.matched,
              llmMatchedSnippets: snippetsJson,
            },
          });
        }
      }
      this.logger.log(`Saved LLM grading result ${gradingResult.id} for submission ${submission.id}`);
    }

    return {
      checkpoints: checkpointMatches,
      submissionId: submission.id,
      method,
    };
  }

  async findByStudent(studentId: string) {
    const student = await this.prisma.student.findUnique({ where: { id: studentId } });
    if (!student) {
      throw new NotFoundException(`Student with ID ${studentId} not found`);
    }

    const submissionStudents = await this.prisma.submissionStudent.findMany({
      where: { studentId },
      include: {
        submission: {
          include: {
            exercise: true,
            submissionStudents: { include: { student: true } },
            gradingResult: {
              include: {
                checkpointResults: {
                  include: { checkpoint: true },
                  orderBy: { checkpoint: { order: 'asc' } },
                },
              },
            },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return submissionStudents.map((ss) => ({
      id: ss.submission.id,
      exerciseId: ss.submission.exerciseId,
      exerciseTitle: ss.submission.exercise.title,
      fileName: ss.submission.fileName,
      fileUrl: ss.submission.fileUrl,
      fileType: ss.submission.fileType,
      createdAt: ss.submission.createdAt,
      students: ss.submission.submissionStudents.map((s) => ({
        id: s.student.id,
        studentIdentifier: s.student.studentIdentifier,
        firstName: s.student.firstName,
        lastName: s.student.lastName,
        email: s.student.email,
      })),
      gradingResult: ss.submission.gradingResult
        ? {
            id: ss.submission.gradingResult.id,
            totalCheckpoints: ss.submission.gradingResult.totalCheckpoints,
            passedCheckpoints: ss.submission.gradingResult.passedCheckpoints,
            score: ss.submission.gradingResult.score,
            teacherScore: ss.submission.gradingResult.teacherScore,
            gradedAt: ss.submission.gradingResult.gradedAt,
            llmPassedCheckpoints: ss.submission.gradingResult.llmPassedCheckpoints,
            llmScore: ss.submission.gradingResult.llmScore,
            checkpointResults: ss.submission.gradingResult.checkpointResults.map((cr) => ({
              id: cr.id,
              checkpointId: cr.checkpointId,
              checkpointDescription: cr.checkpoint.description,
              checkpointOrder: cr.checkpoint.order,
              matched: cr.matched,
              matchedSnippets: cr.matchedSnippets.map((s) => JSON.parse(s)),
              llmMatched: cr.llmMatched,
              llmMatchedSnippets: cr.llmMatchedSnippets.map((s) => JSON.parse(s)),
            })),
          }
        : null,
    }));
  }

  async findByExercise(exerciseId: string) {
    const submissions = await this.prisma.submission.findMany({
      where: { exerciseId },
      include: {
        exercise: true,
        submissionStudents: { include: { student: true } },
        gradingResult: {
          include: {
            checkpointResults: {
              include: { checkpoint: true },
              orderBy: { checkpoint: { order: 'asc' } },
            },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return submissions.map((s) => ({
      id: s.id,
      exerciseId: s.exerciseId,
      exerciseTitle: s.exercise.title,
      fileName: s.fileName,
      fileUrl: s.fileUrl,
      fileType: s.fileType,
      createdAt: s.createdAt,
      students: s.submissionStudents.map((ss) => ({
        id: ss.student.id,
        studentIdentifier: ss.student.studentIdentifier,
        firstName: ss.student.firstName,
        lastName: ss.student.lastName,
        email: ss.student.email,
      })),
      gradingResult: s.gradingResult
        ? {
            id: s.gradingResult.id,
            totalCheckpoints: s.gradingResult.totalCheckpoints,
            passedCheckpoints: s.gradingResult.passedCheckpoints,
            score: s.gradingResult.score,
            teacherScore: s.gradingResult.teacherScore,
            gradedAt: s.gradingResult.gradedAt,
            llmPassedCheckpoints: s.gradingResult.llmPassedCheckpoints,
            llmScore: s.gradingResult.llmScore,
            checkpointResults: s.gradingResult.checkpointResults.map((cr) => ({
              id: cr.id,
              checkpointId: cr.checkpointId,
              checkpointDescription: cr.checkpoint.description,
              checkpointOrder: cr.checkpoint.order,
              matched: cr.matched,
              matchedSnippets: cr.matchedSnippets,
              llmMatched: cr.llmMatched,
              llmMatchedSnippets: cr.llmMatchedSnippets,
            })),
          }
        : null,
    }));
  }

  async findAll(): Promise<SubmissionResponseDto[]> {
    const submissions = await this.prisma.submission.findMany({
      include: SUBMISSION_INCLUDE,
      orderBy: { createdAt: 'desc' },
    });
    return submissions.map(this.mapToResponseDto);
  }

  async findOne(id: string) {
    const submission = await this.prisma.submission.findUnique({
      where: { id },
      include: {
        exercise: true,
        submissionStudents: { include: { student: true } },
        gradingResult: {
          include: {
            checkpointResults: {
              include: { checkpoint: true },
              orderBy: { checkpoint: { order: 'asc' } },
            },
          },
        },
      },
    });
    if (!submission) {
      throw new NotFoundException(`Submission with ID ${id} not found`);
    }
    return {
      id: submission.id,
      exerciseId: submission.exerciseId,
      exerciseTitle: submission.exercise.title,
      fileName: submission.fileName,
      fileUrl: submission.fileUrl,
      fileType: submission.fileType,
      createdAt: submission.createdAt,
      students: submission.submissionStudents.map((ss) => ({
        id: ss.student.id,
        studentIdentifier: ss.student.studentIdentifier,
        firstName: ss.student.firstName,
        lastName: ss.student.lastName,
        email: ss.student.email,
      })),
      gradingResult: submission.gradingResult
        ? {
            id: submission.gradingResult.id,
            totalCheckpoints: submission.gradingResult.totalCheckpoints,
            passedCheckpoints: submission.gradingResult.passedCheckpoints,
            score: submission.gradingResult.score,
            teacherScore: submission.gradingResult.teacherScore,
            gradedAt: submission.gradingResult.gradedAt,
            checkpointResults: submission.gradingResult.checkpointResults.map((cr) => ({
              id: cr.id,
              checkpointId: cr.checkpointId,
              checkpointDescription: cr.checkpoint.description,
              checkpointOrder: cr.checkpoint.order,
              matched: cr.matched,
              matchedSnippets: cr.matchedSnippets,
            })),
          }
        : null,
    };
  }

  async remove(id: string): Promise<void> {
    try {
      await this.prisma.submission.delete({ where: { id } });
    } catch {
      throw new NotFoundException(`Submission with ID ${id} not found`);
    }
  }

  private async extractPdfContent(buffer: Buffer, filename: string): Promise<string | null> {
    try {
      const formData = new FormData();
      formData.append('file', buffer, { filename, contentType: 'application/pdf' });
      const { data } = await firstValueFrom(
        this.httpService.post(`${this.pythonServiceUrl}/extract-pdf`, formData, {
          headers: formData.getHeaders(),
        }),
      );
      return data.extracted_text ?? null;
    } catch (err) {
      this.logger.error(`PDF extraction failed for ${filename}: ${err.message}`);
      return null;
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
        totalCheckpoints: submission.gradingResult.totalCheckpoints,
        passedCheckpoints: submission.gradingResult.passedCheckpoints,
      };
    }

    return dto;
  }
}

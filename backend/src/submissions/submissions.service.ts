import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Logger,
} from "@nestjs/common";
import { HttpService } from "@nestjs/axios";
import { ConfigService } from "@nestjs/config";
import { PrismaService } from "../prisma/prisma.service";
import { SubmissionResponseDto } from "./dto/submission.dto";
import AdmZip from "adm-zip";
import { createExtractorFromData } from "node-unrar-js";
import * as fs from "fs";
import * as path from "path";
import { firstValueFrom } from "rxjs";
import FormData = require("form-data");

const ALLOWED_EXTENSIONS = [
  ".sql",
  ".txt",
  ".py",
  ".js",
  ".ts",
  ".tsx",
  ".jsx",
  ".java",
  ".c",
  ".cpp",
  ".cs",
  ".php",
  ".rb",
  ".go",
  ".pdf",
];

// Multer (busboy) and adm-zip both decode non-ASCII bytes as Latin-1 when the
// UTF-8 encoding flag is absent. If those bytes were actually UTF-8 (common with
// Greek filenames on Windows), re-interpreting Latin-1 → raw bytes → UTF-8 restores
// the original string. Falls back to the original when the bytes are not valid UTF-8.
function decodeFilename(name: string): string {
  try {
    const decoded = Buffer.from(name, "latin1").toString("utf8");
    return decoded.includes("�") ? name : decoded;
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

type FetchedGradeData =
  | {
      kind: "standard";
      method: "regex" | "llm";
      checkpointMatches: CheckpointMatch[];
    }
  | { kind: "project-existing"; checkpointMatches: CheckpointMatch[] }
  | {
      kind: "project-new";
      discovered: Array<{
        description: string;
        matched: boolean;
        matched_snippets: Array<{
          file: string;
          line: number;
          snippet: string;
        }>;
      }>;
    };

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
    this.pythonServiceUrl = this.configService.get(
      "PYTHON_SERVICE_URL",
      "http://localhost:8000",
    );
  }

  async uploadAndGradeZip(
    exerciseId: string,
    studentIds: string[],
    file: Express.Multer.File,
    method: "regex" | "llm" = "regex",
  ) {
    // 1. Verify exercise exists and is approved
    const exercise = await this.prisma.exercise.findUnique({
      where: { id: exerciseId },
      include: { checkpoints: { orderBy: { order: "asc" } } },
    });

    if (!exercise) {
      throw new NotFoundException(`Exercise with ID ${exerciseId} not found`);
    }
    if (exercise.status !== "APPROVED") {
      throw new BadRequestException(
        "Exercise must be approved before accepting submissions",
      );
    }
    if (
      exercise.checkpoints.length === 0 &&
      (exercise as any).exerciseType !== "PROJECT"
    ) {
      throw new BadRequestException("Exercise has no checkpoints defined");
    }

    // 2. Verify all students exist
    const students = await this.prisma.student.findMany({
      where: { id: { in: studentIds } },
      orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
    });
    if (students.length !== studentIds.length) {
      throw new BadRequestException("One or more student IDs are invalid");
    }

    // 3. Check for existing submissions for these students in this exercise
    const existingSubmissionStudents =
      await this.prisma.submissionStudent.findMany({
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
        const allStudentsInSubmission =
          await this.prisma.submissionStudent.findMany({
            where: { submissionId },
            select: { studentId: true },
          });

        const allStudentIdsInSubmission = allStudentsInSubmission.map(
          (ss) => ss.studentId,
        );

        // Check if EXACTLY the same group of students
        const requestedStudentIdsSet = new Set(studentIds);
        const existingStudentIdsSet = new Set(allStudentIdsInSubmission);

        const sameStudents =
          requestedStudentIdsSet.size === existingStudentIdsSet.size &&
          [...requestedStudentIdsSet].every((id) =>
            existingStudentIdsSet.has(id),
          );

        if (sameStudents) {
          // Exact same group - allow update
          existingSubmissionId = submissionId;
        } else {
          // Different group composition - reject
          const studentsWithSubmissions = existingSubmissionStudents.map(
            (ss) =>
              `${ss.student.lastName} ${ss.student.firstName} (${ss.student.studentIdentifier})`,
          );
          throw new BadRequestException(
            `Έχει ήδη υποβληθεί άσκηση για τον/τους μαθητή/ές: ${studentsWithSubmissions.join(", ")}. ` +
              `Δεν μπορείτε να αλλάξετε την ομάδα μετά την υποβολή.`,
          );
        }
      } else {
        // Students belong to DIFFERENT submissions - reject
        const studentsWithSubmissions = existingSubmissionStudents.map(
          (ss) =>
            `${ss.student.lastName} ${ss.student.firstName} (${ss.student.studentIdentifier})`,
        );
        throw new BadRequestException(
          `Έχει ήδη υποβληθεί άσκηση για τον/τους μαθητή/ές: ${studentsWithSubmissions.join(", ")}`,
        );
      }
    }

    // 4. Extract file contents
    let extractedFiles: Array<{ relativePath: string; content: string }> = [];

    try {
      if (file.originalname.endsWith(".zip")) {
        const zip = new AdmZip(file.path);
        for (const entry of zip.getEntries()) {
          if (entry.isDirectory) continue;
          const ext = path.extname(entry.entryName).toLowerCase();
          if (!ALLOWED_EXTENSIONS.includes(ext)) continue;
          const entryName = decodeFilename(entry.entryName);
          if (ext === ".pdf") {
            const text = await this.extractPdfContent(
              entry.getData(),
              entryName,
            );
            if (text !== null) {
              extractedFiles.push({ relativePath: entryName, content: text });
            }
          } else {
            extractedFiles.push({
              relativePath: entryName,
              content: entry.getData().toString("utf8"),
            });
          }
        }
      } else if (file.originalname.endsWith(".rar")) {
        const buf = fs.readFileSync(file.path);
        const arrayBuffer = buf.buffer.slice(
          buf.byteOffset,
          buf.byteOffset + buf.byteLength,
        ) as ArrayBuffer;
        const extractor = await createExtractorFromData({ data: arrayBuffer });
        const { files } = extractor.extract();
        for (const entry of files) {
          if (entry.fileHeader.flags.directory) continue;
          if (!entry.extraction) continue;
          const ext = path.extname(entry.fileHeader.name).toLowerCase();
          if (!ALLOWED_EXTENSIONS.includes(ext)) continue;
          const entryName = decodeFilename(entry.fileHeader.name);
          const content = Buffer.from(entry.extraction);
          if (ext === ".pdf") {
            const text = await this.extractPdfContent(content, entryName);
            if (text !== null) {
              extractedFiles.push({ relativePath: entryName, content: text });
            }
          } else {
            extractedFiles.push({
              relativePath: entryName,
              content: content.toString("utf8"),
            });
          }
        }
      } else {
        const ext = path.extname(file.originalname).toLowerCase();
        if (!ALLOWED_EXTENSIONS.includes(ext)) {
          throw new BadRequestException(`File type ${ext} is not allowed`);
        }
        const originalName = decodeFilename(file.originalname);
        if (ext === ".pdf") {
          const text = await this.extractPdfContent(
            fs.readFileSync(file.path),
            originalName,
          );
          if (text === null) {
            throw new BadRequestException(
              `Failed to extract text from PDF "${originalName}". Ensure the Python service is running and the file is a valid PDF.`,
            );
          }
          extractedFiles.push({ relativePath: originalName, content: text });
        } else {
          extractedFiles.push({
            relativePath: originalName,
            content: fs.readFileSync(file.path, "utf8"),
          });
        }
      }
    } catch (error) {
      throw new BadRequestException(
        `Failed to extract files: ${error instanceof Error ? error.message : String(error)}`,
      );
    }

    if (extractedFiles.length === 0) {
      throw new BadRequestException(
        "No valid files found in the uploaded archive",
      );
    }

    const combinedContent = extractedFiles
      .map((f) => `// File: ${f.relativePath}\n${f.content}`)
      .join("\n\n");

    // 5. Call Python grading service before any DB write — if it fails, nothing is persisted
    const gradeData = await this.fetchGradeData(
      exercise,
      extractedFiles,
      method,
    );

    // 6. Atomically save submission + grading results
    const result = await this.prisma.$transaction(async (tx) => {
      let submission: any;
      if (existingSubmissionId) {
        submission = await tx.submission.update({
          where: { id: existingSubmissionId },
          data: {
            fileName: decodeFilename(file.originalname),
            fileUrl: `/uploads/submissions/${file.filename}`,
            fileType: path.extname(file.originalname),
            content: combinedContent,
            updatedAt: new Date(),
          },
        });
      } else {
        submission = await tx.submission.create({
          data: {
            exerciseId,
            fileName: decodeFilename(file.originalname),
            fileUrl: `/uploads/submissions/${file.filename}`,
            fileType: path.extname(file.originalname),
            content: combinedContent,
          },
        });
        await tx.submissionStudent.createMany({
          data: studentIds.map((studentId) => ({
            submissionId: submission.id,
            studentId,
          })),
          skipDuplicates: true,
        });
      }

      const { checkpointMatches, method: resolvedMethod } =
        await this.persistGradeData(tx, submission.id, exercise.id, gradeData);
      return {
        checkpoints: checkpointMatches,
        submissionId: submission.id,
        method: resolvedMethod,
      };
    });

    if ((exercise as any).exerciseType === "PROJECT") {
      await this.generateAndSaveProjectReport(
        result.submissionId,
        result.checkpoints,
        exercise!.title,
      );
    }

    // Return the full submission (same shape as GET /submissions/:id) so the
    // caller always sees both regex and LLM results together, regardless of
    // which method was just run.
    return this.findOne(result.submissionId);
  }

  async regradeSubmission(submissionId: string, method: "regex" | "llm") {
    const submission = await this.prisma.submission.findUnique({
      where: { id: submissionId },
      select: { id: true, exerciseId: true, content: true },
    });

    if (!submission) {
      throw new NotFoundException(
        `Submission with ID ${submissionId} not found`,
      );
    }
    if (!submission.content) {
      throw new BadRequestException(
        "Submission has no stored content to regrade",
      );
    }

    const exercise = await this.prisma.exercise.findUnique({
      where: { id: submission.exerciseId },
      include: { checkpoints: { orderBy: { order: "asc" } } },
    });

    if (!exercise) {
      throw new NotFoundException(`Exercise for submission not found`);
    }
    if (exercise.status !== "APPROVED") {
      throw new BadRequestException(
        "Exercise must be approved before regrading",
      );
    }
    if (
      exercise.checkpoints.length === 0 &&
      (exercise as any).exerciseType !== "PROJECT"
    ) {
      throw new BadRequestException("Exercise has no checkpoints defined");
    }

    const extractedFiles = this.parseStoredContent(submission.content);
    if (extractedFiles.length === 0) {
      throw new BadRequestException(
        "Could not parse stored submission content",
      );
    }

    if ((exercise as any).exerciseType === "PROJECT") {
      const result = await this.gradeProjectAndSave(
        submissionId,
        exercise,
        extractedFiles,
      );
      await this.generateAndSaveProjectReport(
        submissionId,
        result.checkpoints,
        exercise.title,
      );
      return this.findOne(submissionId);
    }
    await this.gradeAndSave(submissionId, exercise, extractedFiles, method);
    return this.findOne(submissionId);
  }

  async explainRegexFailures(
    submissionId: string,
  ): Promise<{
    submissionId: string;
    explanations: Array<{
      checkpointId: string;
      checkpointDescription: string;
      checkpointOrder: number;
      explanation: string;
    }>;
  }> {
    const submission = await this.prisma.submission.findUnique({
      where: { id: submissionId },
      select: { id: true, exerciseId: true, content: true },
    });

    if (!submission) {
      throw new NotFoundException(
        `Submission with ID ${submissionId} not found`,
      );
    }
    if (!submission.content) {
      throw new BadRequestException("Submission has no stored content");
    }

    const exercise = await this.prisma.exercise.findUnique({
      where: { id: submission.exerciseId },
      include: { checkpoints: true },
    });

    if (!exercise) {
      throw new NotFoundException(`Exercise for submission not found`);
    }
    if ((exercise as any).exerciseType === "PROJECT") {
      throw new BadRequestException(
        "Regex failure explanations are not available for project exercises",
      );
    }

    const gradingResult = await this.prisma.gradingResult.findUnique({
      where: { submissionId },
      include: { checkpointResults: { include: { checkpoint: true } } },
    });

    if (!gradingResult) {
      throw new BadRequestException("Submission has not been graded yet");
    }

    const failedResults = gradingResult.checkpointResults.filter(
      (cr) => cr.matched === false,
    );
    if (failedResults.length === 0) {
      throw new BadRequestException("No failed regex checkpoints to explain");
    }

    const extractedFiles = this.parseStoredContent(submission.content);
    if (extractedFiles.length === 0) {
      throw new BadRequestException(
        "Could not parse stored submission content",
      );
    }

    this.logger.log(
      `Explaining ${failedResults.length} failed regex checkpoints for submission ${submissionId}`,
    );

    const res = await firstValueFrom(
      this.httpService.post(`${this.pythonServiceUrl}/explain-regex-failures`, {
        checkpoints: failedResults.map((cr) => ({
          id: cr.checkpointId,
          description: cr.checkpoint.description,
          pattern: cr.checkpoint.pattern,
          case_sensitive: cr.checkpoint.caseSensitive,
        })),
        files: extractedFiles.map((f) => ({
          relative_path: f.relativePath,
          content: f.content,
        })),
      }),
    );

    const explanationsByCheckpointId = new Map<string, string>(
      res.data.results.map((r: any) => [r.checkpoint_id, r.explanation]),
    );

    const explanations: Array<{
      checkpointId: string;
      checkpointDescription: string;
      checkpointOrder: number;
      explanation: string;
    }> = [];

    for (const cr of failedResults) {
      const explanation = explanationsByCheckpointId.get(cr.checkpointId);
      if (!explanation) continue;
      await this.prisma.checkpointResult.update({
        where: { id: cr.id },
        data: { regexFailureExplanation: explanation },
      });
      explanations.push({
        checkpointId: cr.checkpointId,
        checkpointDescription: cr.checkpoint.description,
        checkpointOrder: cr.checkpoint.order,
        explanation,
      });
    }

    explanations.sort((a, b) => a.checkpointOrder - b.checkpointOrder);

    this.logger.log(
      `Saved ${explanations.length} regex failure explanations for submission ${submissionId}`,
    );

    return { submissionId, explanations };
  }

  async findByStudent(studentId: string) {
    const student = await this.prisma.student.findUnique({
      where: { id: studentId },
    });
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
            gradingResult: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
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
            llmPassedCheckpoints:
              ss.submission.gradingResult.llmPassedCheckpoints,
            llmScore: ss.submission.gradingResult.llmScore,
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
        gradingResult: true,
      },
      orderBy: { createdAt: "desc" },
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
          }
        : null,
    }));
  }

  async findAll(): Promise<SubmissionResponseDto[]> {
    const submissions = await this.prisma.submission.findMany({
      include: SUBMISSION_INCLUDE,
      orderBy: { createdAt: "desc" },
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
              orderBy: { checkpoint: { order: "asc" } },
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
      exerciseType: submission.exercise.exerciseType.toLowerCase() as
        | "exercise"
        | "project",
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
            llmPassedCheckpoints: submission.gradingResult.llmPassedCheckpoints,
            llmScore: submission.gradingResult.llmScore,
            teacherScore: submission.gradingResult.teacherScore,
            gradedAt: submission.gradingResult.gradedAt,
            projectReport:
              (submission.gradingResult as any).projectReport ?? null,
            projectReportAt:
              (submission.gradingResult as any).projectReportAt ?? null,
            checkpointResults: submission.gradingResult.checkpointResults.map(
              (cr) => ({
                id: cr.id,
                checkpointId: cr.checkpointId,
                checkpointDescription: cr.checkpoint.description,
                checkpointOrder: cr.checkpoint.order,
                matched: cr.matched,
                matchedSnippets: cr.matchedSnippets,
                llmMatched: cr.llmMatched,
                llmMatchedSnippets: cr.llmMatchedSnippets,
                regexFailureExplanation: cr.regexFailureExplanation ?? null,
                teacherAccepted: cr.teacherAccepted,
              }),
            ),
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

  private parseStoredContent(
    content: string,
  ): Array<{ relativePath: string; content: string }> {
    const parts = content.split(/\n\n(?=\/\/ File: )/);
    return parts
      .map((part) => {
        const firstNewline = part.indexOf("\n");
        if (firstNewline === -1) return null;
        const relativePath = part.slice("// File: ".length, firstNewline);
        const fileContent = part.slice(firstNewline + 1);
        return relativePath.length > 0
          ? { relativePath, content: fileContent }
          : null;
      })
      .filter(
        (f): f is { relativePath: string; content: string } => f !== null,
      );
  }

  private async fetchGradeData(
    exercise: {
      id: string;
      extractedText?: string | null;
      checkpoints: Array<{
        id: string;
        description: string;
        pattern: string;
        caseSensitive: boolean;
        order: number;
      }>;
    },
    extractedFiles: Array<{ relativePath: string; content: string }>,
    method: "regex" | "llm",
  ): Promise<FetchedGradeData> {
    const isProject = (exercise as any).exerciseType === "PROJECT";

    if (isProject) {
      if (exercise.checkpoints.length > 0) {
        this.logger.log(
          `Project re-grade: reusing ${exercise.checkpoints.length} existing checkpoints via /grade-llm`,
        );
        const res = await firstValueFrom(
          this.httpService.post(`${this.pythonServiceUrl}/grade-llm`, {
            checkpoints: exercise.checkpoints.map((cp) => ({
              id: cp.id,
              description: cp.description,
              pattern: "",
            })),
            files: extractedFiles.map((f) => ({
              relative_path: f.relativePath,
              content: f.content,
            })),
          }),
        );
        const checkpointMatches: CheckpointMatch[] = res.data.results.map(
          (r: any) => {
            const cp = exercise.checkpoints.find(
              (c) => c.id === r.checkpoint_id,
            )!;
            return {
              checkpointId: r.checkpoint_id,
              checkpointDescription: cp.description,
              matched: r.matched,
              matchedSnippets: r.matched_snippets ?? [],
            };
          },
        );
        return { kind: "project-existing", checkpointMatches };
      } else {
        this.logger.log(
          "Project first-grade: calling /grade-project-llm to discover questions",
        );
        const res = await firstValueFrom(
          this.httpService.post(`${this.pythonServiceUrl}/grade-project-llm`, {
            exercise_text: (exercise as any).extractedText || "",
            files: extractedFiles.map((f) => ({
              relative_path: f.relativePath,
              content: f.content,
            })),
          }),
        );
        const discovered = res.data.results;
        if (discovered.length === 0) {
          throw new BadRequestException(
            "LLM could not identify any questions in the exercise text",
          );
        }
        return { kind: "project-new", discovered };
      }
    }

    const pythonEndpoint = method === "llm" ? "/grade-llm" : "/grade";
    this.logger.log(
      `Sending grading request [${method}]: ${exercise.checkpoints.length} checkpoints, ${extractedFiles.length} files`,
    );
    const res = await firstValueFrom(
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
    const checkpointMatches: CheckpointMatch[] = res.data.results.map(
      (r: any) => {
        const cp = exercise.checkpoints.find((c) => c.id === r.checkpoint_id)!;
        this.logger.debug(
          `Checkpoint "${cp.description}" (${r.checkpoint_id}): matched=${r.matched}, snippets=${r.matched_snippets?.length ?? 0}`,
        );
        for (const s of r.matched_snippets ?? []) {
          this.logger.debug(
            `  -> ${s.file}:${s.line} | ${String(s.snippet).slice(0, 120)}`,
          );
        }
        return {
          checkpointId: r.checkpoint_id,
          checkpointDescription: cp.description,
          matched: r.matched,
          matchedSnippets: r.matched_snippets,
        };
      },
    );
    return { kind: "standard", method, checkpointMatches };
  }

  private async persistGradeData(
    tx: any,
    submissionId: string,
    exerciseId: string,
    gradeData: FetchedGradeData,
  ): Promise<{
    checkpointMatches: CheckpointMatch[];
    method: "regex" | "llm";
  }> {
    let checkpointMatches: CheckpointMatch[];
    const isLlm = gradeData.kind !== "standard" || gradeData.method === "llm";
    const resolvedMethod: "regex" | "llm" =
      gradeData.kind === "standard" ? gradeData.method : "llm";

    if (gradeData.kind === "project-new") {
      const createdCheckpoints = await Promise.all(
        gradeData.discovered.map((q, idx) =>
          tx.checkpoint.create({
            data: {
              exerciseId,
              order: idx + 1,
              description: q.description,
              pattern: "",
              caseSensitive: false,
              patternDescription: "",
              indicatorSolution: "",
            },
          }),
        ),
      );
      checkpointMatches = gradeData.discovered.map((q, idx) => ({
        checkpointId: createdCheckpoints[idx].id,
        checkpointDescription: q.description,
        matched: q.matched,
        matchedSnippets: q.matched_snippets ?? [],
      }));
      this.logger.log(
        `Created ${createdCheckpoints.length} checkpoint records for project ${exerciseId}`,
      );
    } else {
      checkpointMatches = gradeData.checkpointMatches;
    }

    const passed = checkpointMatches.filter((m) => m.matched).length;
    const total = checkpointMatches.length;
    this.logger.log(
      `Grading result [${resolvedMethod}]: ${passed}/${total} checkpoints passed`,
    );

    const gradingResult = await tx.gradingResult.upsert({
      where: { submissionId },
      create: isLlm
        ? {
            submission: { connect: { id: submissionId } },
            totalCheckpoints: total,
            passedCheckpoints: null,
            score: null,
            llmPassedCheckpoints: passed,
            llmScore: (passed / total) * 100,
          }
        : {
            submission: { connect: { id: submissionId } },
            totalCheckpoints: total,
            passedCheckpoints: passed,
            score: (passed / total) * 100,
          },
      update: isLlm
        ? {
            totalCheckpoints: total,
            llmPassedCheckpoints: passed,
            llmScore: (passed / total) * 100,
          }
        : {
            totalCheckpoints: total,
            passedCheckpoints: passed,
            score: (passed / total) * 100,
          },
    });

    const existingCRs: Array<{ id: string; checkpointId: string }> =
      await tx.checkpointResult.findMany({
        where: { gradingResultId: gradingResult.id },
        select: { id: true, checkpointId: true },
      });

    for (const match of checkpointMatches) {
      const snippetsJson = match.matchedSnippets.map((s) =>
        JSON.stringify({ file: s.file, line: s.line, snippet: s.snippet }),
      );
      const existing = existingCRs.find(
        (r) => r.checkpointId === match.checkpointId,
      );
      if (isLlm) {
        if (existing) {
          await tx.checkpointResult.update({
            where: { id: existing.id },
            data: {
              llmMatched: match.matched,
              llmMatchedSnippets: snippetsJson,
            },
          });
        } else {
          await tx.checkpointResult.create({
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
      } else {
        if (existing) {
          await tx.checkpointResult.update({
            where: { id: existing.id },
            data: { matched: match.matched, matchedSnippets: snippetsJson },
          });
        } else {
          await tx.checkpointResult.create({
            data: {
              gradingResultId: gradingResult.id,
              checkpointId: match.checkpointId,
              matched: match.matched,
              matchedSnippets: snippetsJson,
            },
          });
        }
      }
    }

    const siblingResults = await tx.checkpointResult.findMany({
      where: { gradingResultId: gradingResult.id },
      select: { teacherAccepted: true },
    });
    const teacherScore = siblingResults.filter(
      (cr: { teacherAccepted: boolean | null }) => cr.teacherAccepted === true,
    ).length;
    await tx.gradingResult.update({
      where: { id: gradingResult.id },
      data: { teacherScore },
    });

    this.logger.log(
      `Saved grading result ${gradingResult.id} for submission ${submissionId}`,
    );
    return { checkpointMatches, method: resolvedMethod };
  }

  private async gradeAndSave(
    submissionId: string,
    exercise: {
      id: string;
      checkpoints: Array<{
        id: string;
        description: string;
        pattern: string;
        caseSensitive: boolean;
      }>;
    },
    extractedFiles: Array<{ relativePath: string; content: string }>,
    method: "regex" | "llm",
  ): Promise<{
    checkpoints: CheckpointMatch[];
    submissionId: string;
    method: "regex" | "llm";
  }> {
    const pythonEndpoint = method === "llm" ? "/grade-llm" : "/grade";
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

    const checkpointMatches: CheckpointMatch[] = gradeResponse.data.results.map(
      (r: any) => {
        const cp = exercise.checkpoints.find((c) => c.id === r.checkpoint_id)!;
        this.logger.debug(
          `Checkpoint "${cp.description}" (${r.checkpoint_id}): matched=${r.matched}, snippets=${r.matched_snippets?.length ?? 0}`,
        );
        for (const s of r.matched_snippets ?? []) {
          this.logger.debug(
            `  -> ${s.file}:${s.line} | ${String(s.snippet).slice(0, 120)}`,
          );
        }
        return {
          checkpointId: r.checkpoint_id,
          checkpointDescription: cp.description,
          matched: r.matched,
          matchedSnippets: r.matched_snippets,
        };
      },
    );

    const passed = checkpointMatches.filter((m) => m.matched).length;
    const totalCheckpoints = checkpointMatches.length;
    this.logger.log(
      `Grading result [${method}]: ${passed}/${totalCheckpoints} checkpoints passed`,
    );

    if (method === "regex") {
      const score = (passed / totalCheckpoints) * 100;
      const gradingResult = await this.prisma.gradingResult.upsert({
        where: { submissionId },
        create: {
          submission: { connect: { id: submissionId } },
          totalCheckpoints,
          passedCheckpoints: passed,
          score,
        },
        update: { totalCheckpoints, passedCheckpoints: passed, score },
        // llmScore, llmPassedCheckpoints are intentionally NOT touched here;
        // teacherScore is recomputed below from teacherAccepted flags
      });
      const existingCRs: Array<{ id: string; checkpointId: string }> =
        await this.prisma.checkpointResult.findMany({
          where: { gradingResultId: gradingResult.id },
          select: { id: true, checkpointId: true },
        });
      for (const match of checkpointMatches) {
        const snippetsJson = match.matchedSnippets.map((s) =>
          JSON.stringify({ file: s.file, line: s.line, snippet: s.snippet }),
        );
        const existing = existingCRs.find(
          (r) => r.checkpointId === match.checkpointId,
        );
        if (existing) {
          await this.prisma.checkpointResult.update({
            where: { id: existing.id },
            data: { matched: match.matched, matchedSnippets: snippetsJson },
          });
        } else {
          await this.prisma.checkpointResult.create({
            data: {
              gradingResultId: gradingResult.id,
              checkpointId: match.checkpointId,
              matched: match.matched,
              matchedSnippets: snippetsJson,
            },
          });
        }
      }
      const siblingResults = await this.prisma.checkpointResult.findMany({
        where: { gradingResultId: gradingResult.id },
        select: { teacherAccepted: true },
      });
      const teacherScore = siblingResults.filter(
        (cr) => cr.teacherAccepted === true,
      ).length;
      await this.prisma.gradingResult.update({
        where: { id: gradingResult.id },
        data: { teacherScore },
      });
      this.logger.log(
        `Saved regex grading result ${gradingResult.id} for submission ${submissionId}`,
      );
    } else {
      const db = this.prisma as any;
      const llmScore = (passed / totalCheckpoints) * 100;
      const gradingResult = await db.gradingResult.upsert({
        where: { submissionId },
        create: {
          submission: { connect: { id: submissionId } },
          totalCheckpoints,
          passedCheckpoints: null,
          score: null,
          llmPassedCheckpoints: passed,
          llmScore,
        },
        update: { totalCheckpoints, llmPassedCheckpoints: passed, llmScore },
      });
      const existingCRs: Array<{ id: string; checkpointId: string }> =
        await this.prisma.checkpointResult.findMany({
          where: { gradingResultId: gradingResult.id },
          select: { id: true, checkpointId: true },
        });
      for (const match of checkpointMatches) {
        const snippetsJson = match.matchedSnippets.map((s) =>
          JSON.stringify({ file: s.file, line: s.line, snippet: s.snippet }),
        );
        const existing = existingCRs.find(
          (r) => r.checkpointId === match.checkpointId,
        );
        if (existing) {
          await db.checkpointResult.update({
            where: { id: existing.id },
            data: {
              llmMatched: match.matched,
              llmMatchedSnippets: snippetsJson,
            },
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
      const siblingResults = await db.checkpointResult.findMany({
        where: { gradingResultId: gradingResult.id },
        select: { teacherAccepted: true },
      });
      const teacherScore = siblingResults.filter(
        (cr: { teacherAccepted: boolean | null }) =>
          cr.teacherAccepted === true,
      ).length;
      await db.gradingResult.update({
        where: { id: gradingResult.id },
        data: { teacherScore },
      });
      this.logger.log(
        `Saved LLM grading result ${gradingResult.id} for submission ${submissionId}`,
      );
    }

    return { checkpoints: checkpointMatches, submissionId, method };
  }

  private async generateAndSaveProjectReport(
    submissionId: string,
    checkpoints: CheckpointMatch[],
    exerciseTitle: string,
  ): Promise<string | null> {
    try {
      const questions = checkpoints.map((c) => ({
        description: c.checkpointDescription,
        matched: c.matched,
      }));
      const { data } = await firstValueFrom(
        this.httpService.post(
          `${this.pythonServiceUrl}/generate-project-report`,
          {
            exercise_title: exerciseTitle,
            questions,
          },
        ),
      );
      await (this.prisma as any).gradingResult.update({
        where: { submissionId },
        data: { projectReport: data.report, projectReportAt: new Date() },
      });
      this.logger.log(`Saved project report for submission ${submissionId}`);
      return data.report as string;
    } catch (err) {
      this.logger.error(
        `Failed to generate project report for submission ${submissionId}: ${err}`,
      );
      return null;
    }
  }

  private async gradeProjectAndSave(
    submissionId: string,
    exercise: {
      id: string;
      extractedText?: string | null;
      checkpoints: Array<{
        id: string;
        description: string;
        order: number;
        pattern: string;
        caseSensitive: boolean;
      }>;
    },
    extractedFiles: Array<{ relativePath: string; content: string }>,
  ): Promise<{
    checkpoints: CheckpointMatch[];
    submissionId: string;
    method: "regex" | "llm";
  }> {
    const exerciseText = (exercise as any).extractedText || "";

    let checkpointMatches: CheckpointMatch[];

    if (exercise.checkpoints.length > 0) {
      // Questions were auto-created from a prior grading — reuse them via the standard LLM grader
      this.logger.log(
        `Project re-grade: reusing ${exercise.checkpoints.length} existing checkpoints via /grade-llm`,
      );
      const gradeResponse = await firstValueFrom(
        this.httpService.post(`${this.pythonServiceUrl}/grade-llm`, {
          checkpoints: exercise.checkpoints.map((cp) => ({
            id: cp.id,
            description: cp.description,
            pattern: "",
          })),
          files: extractedFiles.map((f) => ({
            relative_path: f.relativePath,
            content: f.content,
          })),
        }),
      );
      checkpointMatches = gradeResponse.data.results.map((r: any) => {
        const cp = exercise.checkpoints.find((c) => c.id === r.checkpoint_id)!;
        return {
          checkpointId: r.checkpoint_id,
          checkpointDescription: cp.description,
          matched: r.matched,
          matchedSnippets: r.matched_snippets ?? [],
        };
      });
    } else {
      // First-time grading — ask the LLM to discover questions from the exercise text
      this.logger.log(
        "Project first-grade: calling /grade-project-llm to discover questions",
      );
      const gradeResponse = await firstValueFrom(
        this.httpService.post(`${this.pythonServiceUrl}/grade-project-llm`, {
          exercise_text: exerciseText,
          files: extractedFiles.map((f) => ({
            relative_path: f.relativePath,
            content: f.content,
          })),
        }),
      );

      const discovered: Array<{
        question_id: string;
        description: string;
        matched: boolean;
        matched_snippets: Array<{
          file: string;
          line: number;
          snippet: string;
        }>;
      }> = gradeResponse.data.results;

      if (discovered.length === 0) {
        throw new BadRequestException(
          "LLM could not identify any questions in the exercise text",
        );
      }

      // Create checkpoint records for the discovered questions
      const createdCheckpoints = await this.prisma.$transaction(
        discovered.map((q, idx) =>
          this.prisma.checkpoint.create({
            data: {
              exerciseId: exercise.id,
              order: idx + 1,
              description: q.description,
              pattern: "",
              caseSensitive: false,
              patternDescription: "",
              indicatorSolution: "",
            },
          }),
        ),
      );

      checkpointMatches = discovered.map((q, idx) => ({
        checkpointId: createdCheckpoints[idx].id,
        checkpointDescription: q.description,
        matched: q.matched,
        matchedSnippets: q.matched_snippets ?? [],
      }));

      this.logger.log(
        `Created ${createdCheckpoints.length} checkpoint records for project ${exercise.id}`,
      );
    }

    const passed = checkpointMatches.filter((m) => m.matched).length;
    const totalCheckpoints = checkpointMatches.length;
    const llmScore = (passed / totalCheckpoints) * 100;

    const gradingResult = await (this.prisma as any).gradingResult.upsert({
      where: { submissionId },
      create: {
        submission: { connect: { id: submissionId } },
        totalCheckpoints,
        passedCheckpoints: null,
        score: null,
        llmPassedCheckpoints: passed,
        llmScore,
      },
      update: { totalCheckpoints, llmPassedCheckpoints: passed, llmScore },
    });

    const existingCRs: Array<{ id: string; checkpointId: string }> =
      await this.prisma.checkpointResult.findMany({
        where: { gradingResultId: gradingResult.id },
        select: { id: true, checkpointId: true },
      });

    for (const match of checkpointMatches) {
      const snippetsJson = match.matchedSnippets.map((s) =>
        JSON.stringify({ file: s.file, line: s.line, snippet: s.snippet }),
      );
      const existing = existingCRs.find(
        (r) => r.checkpointId === match.checkpointId,
      );
      if (existing) {
        await (this.prisma as any).checkpointResult.update({
          where: { id: existing.id },
          data: { llmMatched: match.matched, llmMatchedSnippets: snippetsJson },
        });
      } else {
        await (this.prisma as any).checkpointResult.create({
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

    this.logger.log(
      `Saved project LLM grading result ${gradingResult.id} for submission ${submissionId}: ${passed}/${totalCheckpoints}`,
    );

    return { checkpoints: checkpointMatches, submissionId, method: "llm" };
  }

  private async extractPdfContent(
    buffer: Buffer,
    filename: string,
  ): Promise<string | null> {
    const attempt = async () => {
      const formData = new FormData();
      formData.append("file", buffer, {
        filename,
        contentType: "application/pdf",
      });
      const { data } = await firstValueFrom(
        this.httpService.post(
          `${this.pythonServiceUrl}/extract-pdf`,
          formData,
          {
            headers: formData.getHeaders(),
          },
        ),
      );
      return data.extracted_text ?? null;
    };

    try {
      return await attempt();
    } catch (firstErr) {
      this.logger.warn(
        `PDF extraction failed for ${filename} (attempt 1), retrying in 500ms…`,
      );
      await new Promise((r) => setTimeout(r, 500));
      try {
        return await attempt();
      } catch (secondErr) {
        const errorMessage =
          secondErr instanceof Error ? secondErr.message : String(secondErr);
        this.logger.error(
          `PDF extraction failed for ${filename} after 2 attempts: ${errorMessage}`,
        );
        return null;
      }
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

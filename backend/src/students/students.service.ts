import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as XLSX from 'xlsx';
import axios from 'axios';
import { PrismaService } from '../prisma/prisma.service';
import { StudentResponseDto } from './dto/student.dto';

interface StudentRow {
  AM: string;
  firstName: string;
  lastName: string;
  email?: string;
}

@Injectable()
export class StudentsService {
  private readonly pythonServiceUrl: string;

  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
  ) {
    this.pythonServiceUrl = this.configService.get('PYTHON_SERVICE_URL', 'http://localhost:8000');
  }

  async importFromFile(file: Express.Multer.File, userId: string): Promise<StudentResponseDto[]> {
    let rows: StudentRow[];

    try {
      const workbook = XLSX.read(file.buffer, { type: 'buffer' });
      const sheet = workbook.Sheets[workbook.SheetNames[0]];
      const raw = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: '' });
      rows = this.parseRows(raw);
    } catch (error) {
      throw new BadRequestException(`Failed to parse file: ${error.message}`);
    }

    if (rows.length === 0) {
      throw new BadRequestException('No valid rows found in file');
    }

    // Upsert all students
    await this.prisma.$transaction(
      rows.map((row) =>
        this.prisma.student.upsert({
          where: { studentIdentifier: row.AM },
          create: {
            studentIdentifier: row.AM,
            firstName: row.firstName,
            lastName: row.lastName,
            email: row.email || null,
            users: {
              connect: {
                id: userId,
              }
            }
          },
          update: {
            firstName: row.firstName,
            lastName: row.lastName,
            email: row.email || null,
          },
        }),
      ),
    );

    return this.findAll(userId);
  }

  async findAll(userId: string): Promise<StudentResponseDto[]> {
    return this.prisma.student.findMany({
      where: { teacherid: userId },
      orderBy: [{ lastName: 'asc' }, { firstName: 'asc' }],
    });
  }

  async findOne(id: string): Promise<StudentResponseDto> {
    const student = await this.prisma.student.findUnique({
      where: { id },
    });

    if (!student) {
      throw new NotFoundException(`Student with ID ${id} not found`);
    }

    return student;
  }

  async getStudentSubmissions(studentId: string) {
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
            submissionStudents: {
              include: {
                student: true,
              },
            },
            gradingResult: {
              include: {
                checkpointResults: {
                  include: {
                    checkpoint: true,
                  },
                  orderBy: {
                    checkpoint: {
                      order: 'asc',
                    },
                  },
                },
              },
            },
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
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
            passed: ss.submission.gradingResult.passed,
            gradedAt: ss.submission.gradingResult.gradedAt,
            checkpointResults: ss.submission.gradingResult.checkpointResults.map((cr) => ({
              id: cr.id,
              checkpointId: cr.checkpointId,
              checkpointDescription: cr.checkpoint.description,
              checkpointOrder: cr.checkpoint.order,
              matched: cr.matched,
              matchedSnippets: cr.matchedSnippets,
            })),
          }
        : null,
    }));
  }

  async getMiniReport(studentId: string): Promise<{ report: string }> {
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
      orderBy: { createdAt: 'asc' },
    });

    const submissions = submissionStudents.map((ss) => ({
      exercise_title: ss.submission.exercise.title,
      submitted_at: new Date(ss.submission.createdAt).toLocaleDateString('el-GR'),
      total_checkpoints: ss.submission.gradingResult?.totalCheckpoints ?? 0,
      passed_checkpoints: ss.submission.gradingResult?.passedCheckpoints ?? 0,
      score: ss.submission.gradingResult?.score ?? 0,
      teacher_score: ss.submission.gradingResult?.teacherScore ?? null,
      checkpoint_results: (ss.submission.gradingResult?.checkpointResults ?? []).map((cr) => ({
        description: cr.checkpoint.description,
        matched: cr.matched,
      })),
    }));

    try {
      const response = await axios.post(
        `${this.pythonServiceUrl}/generate-mini-report`,
        {
          student_name: `${student.lastName} ${student.firstName}`,
          student_identifier: student.studentIdentifier,
          submissions,
        },
        { timeout: 60000 },
      );
      const report: string = response.data.report;

      await this.prisma.student.update({
        where: { id: studentId },
        data: { miniReport: report, miniReportAt: new Date() },
      });

      return { report };
    } catch (error) {
      console.error('Error generating mini report from Python service:', {
        studentId,
        message: error.message,
      });
      throw new Error('Failed to generate mini report from LLM service');
    }
  }

  private parseRows(raw: Record<string, unknown>[]): StudentRow[] {
    return raw
      .map((row) => {
        const am = String(row['AM'] ?? row['am'] ?? '').trim();
        const firstName = String(row['firstName'] ?? row['firstname'] ?? row['FirstName'] ?? row['first_name'] ?? '').trim();
        const lastName = String(row['lastName'] ?? row['lastname'] ?? row['LastName'] ?? row['last_name'] ?? '').trim();
        const email = String(row['email'] ?? row['Email'] ?? '').trim() || undefined;

        return { AM: am, firstName, lastName, email };
      })
      .filter((r) => r.AM && r.firstName && r.lastName);
  }
}

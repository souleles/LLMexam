import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { CreateSubmissionDto, SubmissionResponseDto } from './dto/submission.dto';
import axios from 'axios';

@Injectable()
export class SubmissionsService {
  private readonly pythonServiceUrl: string;

  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
  ) {
    this.pythonServiceUrl = this.configService.get('PYTHON_SERVICE_URL', 'http://localhost:8000');
  }

  async create(createSubmissionDto: CreateSubmissionDto): Promise<SubmissionResponseDto> {
    // Verify exercise exists and is approved
    const exercise = await this.prisma.exercise.findUnique({
      where: { id: createSubmissionDto.exerciseId },
    });

    if (!exercise) {
      throw new NotFoundException(`Exercise with ID ${createSubmissionDto.exerciseId} not found`);
    }

    if (exercise.status !== 'APPROVED') {
      throw new BadRequestException('Exercise must be approved before accepting submissions');
    }

    const submission = await this.prisma.submission.create({
      data: createSubmissionDto,
    });

    return this.mapToResponseDto(submission);
  }

  async uploadAndExtract(
    exerciseId: string,
    studentName: string,
    file: Express.Multer.File,
  ): Promise<SubmissionResponseDto> {
    // Verify exercise exists and is approved
    const exercise = await this.prisma.exercise.findUnique({
      where: { id: exerciseId },
    });

    if (!exercise) {
      throw new NotFoundException(`Exercise with ID ${exerciseId} not found`);
    }

    if (exercise.status !== 'APPROVED') {
      throw new BadRequestException('Exercise must be approved before accepting submissions');
    }

    const fileUrl = `/uploads/submissions/${file.filename}`;
    const fileType = file.originalname.split('.').pop() || '';

    try {
      // Call Python service to extract content
      const response = await axios.post(
        `${this.pythonServiceUrl}/extract/content`,
        {
          filePath: file.path,
          fileType,
        },
        {
          timeout: 30000, // 30 second timeout
        },
      );

      const content = response.data.content || '';

      // Create submission with extracted content
      return this.create({
        exerciseId,
        studentName,
        fileName: file.originalname,
        fileUrl,
        fileType,
        content,
      });
    } catch (error) {
      console.error('Error extracting file content:', error.message);
      throw new BadRequestException('Failed to extract content from file');
    }
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

  async uploadMultiple(
    exerciseId: string,
    files: Express.Multer.File[],
  ): Promise<SubmissionResponseDto[]> {
    // Verify exercise exists
    const exercise = await this.prisma.exercise.findUnique({
      where: { id: exerciseId },
    });

    if (!exercise) {
      throw new NotFoundException(`Exercise with ID ${exerciseId} not found`);
    }

    // Process each file
    const submissions = await Promise.all(
      files.map(file => {
        const fileUrl = `/uploads/submissions/${file.filename}`;
        const fileType = file.originalname.split('.').pop() || '';
        const studentName = file.originalname.replace(/\.[^/.]+$/, ''); // filename without extension

        return this.prisma.submission.create({
          data: {
            exerciseId,
            studentName,
            fileName: file.originalname,
            fileUrl,
            fileType,
            content: '', // Will be extracted later by grading service or separately
          },
        });
      })
    );

    return submissions.map(s => this.mapToResponseDto(s));
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

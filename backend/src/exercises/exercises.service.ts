import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateExerciseDto, UpdateExerciseDto, ExerciseResponseDto } from './dto/exercise.dto';
import { ExerciseStatus } from '@prisma/client';

@Injectable()
export class ExercisesService {
  constructor(private readonly prisma: PrismaService) {}

  async create(createExerciseDto: CreateExerciseDto): Promise<ExerciseResponseDto> {
    const exercise = await this.prisma.exercise.create({
      data: {
        ...createExerciseDto,
        status: ExerciseStatus.DRAFT,
      },
      include: {
        checkpoints: true,
        submissions: true,
      },
    });

    return this.mapToResponseDto(exercise);
  }

  async findAll(): Promise<ExerciseResponseDto[]> {
    const exercises = await this.prisma.exercise.findMany({
      include: {
        checkpoints: true,
        submissions: true,
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    return exercises.map((exercise) => this.mapToResponseDto(exercise));
  }

  async findOne(id: string): Promise<ExerciseResponseDto> {
    const exercise = await this.prisma.exercise.findUnique({
      where: { id },
      include: {
        checkpoints: true,
        submissions: true,
      },
    });

    if (!exercise) {
      throw new NotFoundException(`Exercise with ID ${id} not found`);
    }

    return this.mapToResponseDto(exercise);
  }

  async update(id: string, updateExerciseDto: UpdateExerciseDto): Promise<ExerciseResponseDto> {
    try {
      const exercise = await this.prisma.exercise.update({
        where: { id },
        data: updateExerciseDto,
        include: {
          checkpoints: true,
          submissions: true,
        },
      });

      return this.mapToResponseDto(exercise);
    } catch (error) {
      throw new NotFoundException(`Exercise with ID ${id} not found`);
    }
  }

  async approve(id: string): Promise<ExerciseResponseDto> {
    return this.update(id, { status: ExerciseStatus.APPROVED });
  }

  async remove(id: string): Promise<void> {
    try {
      await this.prisma.exercise.delete({
        where: { id },
      });
    } catch (error) {
      throw new NotFoundException(`Exercise with ID ${id} not found`);
    }
  }
  private mapToResponseDto(exercise: any): ExerciseResponseDto {
    return {
      id: exercise.id,
      title: exercise.title,
      originalPdfPath: exercise.pdfUrl,
      extractedText: exercise.extractedText || undefined,
      status: exercise.status.toLowerCase() as 'draft' | 'approved',
      createdAt: exercise.createdAt.toISOString(),
      updatedAt: exercise.updatedAt.toISOString(),
      checkpointCount: exercise.checkpoints?.length || 0,
      submissionCount: exercise.submissions?.length || 0,
    };
  }
}

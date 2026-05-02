import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateCheckpointDto, UpdateCheckpointDto, CheckpointResponseDto } from './dto/checkpoint.dto';

@Injectable()
export class CheckpointsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(createCheckpointDto: CreateCheckpointDto): Promise<CheckpointResponseDto> {
    // Verify exercise exists
    const exercise = await this.prisma.exercise.findUnique({
      where: { id: createCheckpointDto.exerciseId },
    });

    if (!exercise) {
      throw new NotFoundException(`Exercise with ID ${createCheckpointDto.exerciseId} not found`);
    }

    // Validate regex pattern
    try {
      new RegExp(createCheckpointDto.pattern);
    } catch (error) {
      throw new BadRequestException(`Invalid regex pattern: ${error.message}`);
    }

    return await this.prisma.checkpoint.create({
      data: { ...createCheckpointDto, indicatorSolution: createCheckpointDto.indicatorSolution ?? '' },
    });
  }

  async createMany(exerciseId: string, checkpoints: Omit<CreateCheckpointDto, 'exerciseId'>[]): Promise<CheckpointResponseDto[]> {
    // Verify exercise exists
    const exercise = await this.prisma.exercise.findUnique({
      where: { id: exerciseId },
    });

    if (!exercise) {
      throw new NotFoundException(`Exercise with ID ${exerciseId} not found`);
    }

    // Validate all regex patterns
    for (const checkpoint of checkpoints) {
      try {
        new RegExp(checkpoint.pattern);
      } catch (error) {
        throw new BadRequestException(`Invalid regex pattern in checkpoint "${checkpoint.description}": ${error.message}`);
      }
    }

    // Delete existing checkpoints for this exercise
    await this.prisma.checkpoint.deleteMany({
      where: { exerciseId },
    });

    // Create new checkpoints
    return await Promise.all(
      checkpoints.map((checkpoint) =>
        this.prisma.checkpoint.create({
          data: {
            ...checkpoint,
            exerciseId,
            indicatorSolution: checkpoint.indicatorSolution ?? '',
          },
        }),
      ),
    );
  }

  async findByExercise(exerciseId: string): Promise<CheckpointResponseDto[]> {
    const checkpoints = await this.prisma.checkpoint.findMany({
      where: { exerciseId },
      orderBy: { order: 'asc' },
    });

    return checkpoints;
  }

  async findAll(): Promise<CheckpointResponseDto[]> {
    const checkpoints = await this.prisma.checkpoint.findMany({
      orderBy: { order: 'asc' },
    });

    return checkpoints;
  }

  async findOne(id: string): Promise<CheckpointResponseDto> {
    const checkpoint = await this.prisma.checkpoint.findUnique({
      where: { id },
    });

    if (!checkpoint) {
      throw new NotFoundException(`Checkpoint with ID ${id} not found`);
    }

    return checkpoint;
  }

  async update(id: string, updateCheckpointDto: UpdateCheckpointDto): Promise<CheckpointResponseDto> {
    // Validate regex pattern if provided
    if (updateCheckpointDto.pattern) {
      try {
        new RegExp(updateCheckpointDto.pattern);
      } catch (error) {
        throw new BadRequestException(`Invalid regex pattern: ${error.message}`);
      }
    }

    try {
      const checkpoint = await this.prisma.checkpoint.update({
        where: { id },
        data: updateCheckpointDto,
      });

      return checkpoint;
    } catch (error) {
      throw new NotFoundException(`Checkpoint with ID ${id} not found`);
    }
  }

  async remove(id: string): Promise<void> {
    try {
      await this.prisma.checkpoint.delete({
        where: { id },
      });
    } catch (error) {
      throw new NotFoundException(`Checkpoint with ID ${id} not found`);
    }
  }

  async bulkUpdatePatterns(
    exerciseId: string,
    patterns: { order: number; pattern: string; patternDescription?: string; indicatorSolution?: string }[],
  ): Promise<CheckpointResponseDto[]> {
    const exercise = await this.prisma.exercise.findUnique({
      where: { id: exerciseId },
    });

    if (!exercise) {
      throw new NotFoundException(`Exercise with ID ${exerciseId} not found`);
    }

    await this.prisma.$transaction(
      patterns.map(({ order, pattern, patternDescription, indicatorSolution }) =>
        this.prisma.checkpoint.updateMany({
          where: { exerciseId, order },
          data: { pattern, patternDescription, indicatorSolution },
        }),
      ),
    );

    return this.findByExercise(exerciseId);
  }
}

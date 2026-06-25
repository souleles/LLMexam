import { Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { RuleResponseDto } from "./dto/rule.dto";

@Injectable()
export class RulesService {
  constructor(private readonly prisma: PrismaService) {}

  async findByExercise(exerciseId: string): Promise<RuleResponseDto[]> {
    return this.prisma.rule.findMany({
      where: { exerciseId },
      orderBy: { order: "asc" },
    });
  }

  async replace(
    exerciseId: string,
    contents: string[],
  ): Promise<RuleResponseDto[]> {
    const exercise = await this.prisma.exercise.findUnique({
      where: { id: exerciseId },
    });

    if (!exercise) {
      throw new NotFoundException(`Exercise with ID ${exerciseId} not found`);
    }

    const trimmed = contents.map((c) => c.trim()).filter((c) => c.length > 0);

    await this.prisma.$transaction([
      this.prisma.rule.deleteMany({ where: { exerciseId } }),
      ...trimmed.map((content, index) =>
        this.prisma.rule.create({
          data: { exerciseId, content, order: index + 1 },
        }),
      ),
    ]);

    return this.findByExercise(exerciseId);
  }
}

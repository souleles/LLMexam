import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ConversationResponseDto, CreateConversationDto } from './dto/conversation.dto';

@Injectable()
export class ConversationsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(createConversationDto: CreateConversationDto): Promise<ConversationResponseDto> {
    // Verify exercise exists
    const exercise = await this.prisma.exercise.findUnique({
      where: { id: createConversationDto.exerciseId },
    });

    if (!exercise) {
      throw new NotFoundException(`Exercise with ID ${createConversationDto.exerciseId} not found`);
    }

    const conversation = await this.prisma.conversation.create({
      data: createConversationDto,
    });

    return this.mapToResponseDto(conversation);
  }

  async findByExercise(exerciseId: string): Promise<ConversationResponseDto[]> {
    const conversations = await this.prisma.conversation.findMany({
      where: { exerciseId },
      orderBy: { createdAt: 'asc' },
    });

    return conversations.map((conv) => this.mapToResponseDto(conv));
  }

  private mapToResponseDto(conversation: any): ConversationResponseDto {
    return {
      id: conversation.id,
      exerciseId: conversation.exerciseId,
      role: conversation.role.toLowerCase() as 'professor' | 'assistant',
      content: conversation.content,
      createdAt: conversation.createdAt.toISOString(),
    };
  }
}

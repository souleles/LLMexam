import { Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { ConversationRole, ConversationType } from '@prisma/client';
import axios from 'axios';

@Injectable()
export class LlmService {
  private readonly pythonServiceUrl: string;

  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
  ) {
    this.pythonServiceUrl = this.configService.get('PYTHON_SERVICE_URL', 'http://localhost:8000');
  }

  async saveMessage(
    exerciseId: string,
    role: ConversationRole,
    content: string,
    type: ConversationType = ConversationType.CHECKPOINT,
  ) {
    const exercise = await this.prisma.exercise.findUnique({
      where: { id: exerciseId },
    });

    if (!exercise) {
      throw new NotFoundException(`Exercise with ID ${exerciseId} not found`);
    }

    return this.prisma.conversation.create({
      data: { exerciseId, role, content, type },
    });
  }

  async getConversationHistory(exerciseId: string, type?: ConversationType) {
    const messages = await this.prisma.conversation.findMany({
      where: { exerciseId, ...(type ? { type } : {}) },
      orderBy: { createdAt: 'asc' },
    });

    return messages;
  }

  async *streamResponse(exerciseId: string, message: string): AsyncGenerator<string> {
    await this.saveMessage(exerciseId, ConversationRole.PROFESSOR, message, ConversationType.CHECKPOINT);

    const history = await this.getConversationHistory(exerciseId, ConversationType.CHECKPOINT);

    const exercise = await this.prisma.exercise.findUnique({
      where: { id: exerciseId },
    });

    if (!exercise) {
      throw new NotFoundException(`Exercise with ID ${exerciseId} not found`);
    }

    const currentCheckpoints = await this.prisma.checkpoint.findMany({
      where: { exerciseId },
      orderBy: { order: 'asc' },
    });

    try {
      const response = await axios.post(
        `${this.pythonServiceUrl}/generate-checkpoints`,
        {
          text: exercise.extractedText ?? '',
          current_checkpoints: JSON.stringify(currentCheckpoints),
          message,
          history: history.slice(0, -1).map((msg) => ({
            role: msg.role.toLowerCase(),
            content: msg.content,
          })),
        },
        {
          responseType: 'stream',
          timeout: 120000,
        },
      );

      let fullResponse = '';

      for await (const chunk of response.data) {
        const text = chunk.toString();
        fullResponse += text;
        yield text;
      }

      await this.saveMessage(exerciseId, ConversationRole.ASSISTANT, fullResponse, ConversationType.CHECKPOINT);
    } catch (error) {
      console.error('Error streaming from Python service:', { exerciseId, message: error.message });
      throw new Error('Failed to stream response from LLM service');
    }
  }

  async *streamPatternResponse(exerciseId: string, message: string): AsyncGenerator<string> {
    await this.saveMessage(exerciseId, ConversationRole.PROFESSOR, message, ConversationType.PATTERN);

    const history = await this.getConversationHistory(exerciseId, ConversationType.PATTERN);

    const checkpoints = await this.prisma.checkpoint.findMany({
      where: { exerciseId },
      orderBy: { order: 'asc' },
    });

    if (checkpoints.length === 0) {
      throw new NotFoundException(`No checkpoints found for exercise ${exerciseId}`);
    }

    try {
      const response = await axios.post(
        `${this.pythonServiceUrl}/generate-patterns`,
        {
          checkpoints: checkpoints.map((cp) => ({
            order: cp.order,
            description: cp.description,
            current_pattern: cp.pattern,
          })),
          message,
          history: history.slice(0, -1).map((msg) => ({
            role: msg.role.toLowerCase(),
            content: msg.content,
          })),
        },
        {
          responseType: 'stream',
          timeout: 120000,
        },
      );

      let fullResponse = '';

      for await (const chunk of response.data) {
        const text = chunk.toString();
        fullResponse += text;
        yield text;
      }

      await this.saveMessage(exerciseId, ConversationRole.ASSISTANT, fullResponse, ConversationType.PATTERN);
    } catch (error) {
      console.error('Error streaming patterns from Python service:', { exerciseId, message: error.message });
      throw new Error('Failed to stream pattern response from LLM service');
    }
  }
}

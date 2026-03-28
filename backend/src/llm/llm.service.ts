import { Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { ConversationRole } from '@prisma/client';
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

  async saveMessage(exerciseId: string, role: ConversationRole, content: string) {
    // Verify exercise exists
    const exercise = await this.prisma.exercise.findUnique({
      where: { id: exerciseId },
    });

    if (!exercise) {
      throw new NotFoundException(`Exercise with ID ${exerciseId} not found`);
    }

    return this.prisma.conversation.create({
      data: {
        exerciseId,
        role,
        content,
      },
    });
  }

  async getConversationHistory(exerciseId: string) {
    const messages = await this.prisma.conversation.findMany({
      where: { exerciseId },
      orderBy: { createdAt: 'asc' },
    });

    return messages;
  }

  async *streamResponse(exerciseId: string, message: string): AsyncGenerator<string> {
    // Save professor's message
    await this.saveMessage(exerciseId, ConversationRole.PROFESSOR, message);

    // Get conversation history
    const history = await this.getConversationHistory(exerciseId);
    
    // Get exercise details
    const exercise = await this.prisma.exercise.findUnique({
      where: { id: exerciseId },
    });

    if (!exercise) {
      throw new NotFoundException(`Exercise with ID ${exerciseId} not found`);
    }

    try {
      // Call Python service for streaming response
      const response = await axios.post(
        `${this.pythonServiceUrl}/llm/stream`,
        {
          exerciseId,
          pdfUrl: exercise.pdfUrl,
          message,
          history: history.map((msg) => ({
            role: msg.role.toLowerCase(),
            content: msg.content,
          })),
        },
        {
          responseType: 'stream',
          timeout: 120000, // 2 minute timeout
        },
      );

      let fullResponse = '';

      // Stream the response
      for await (const chunk of response.data) {
        const text = chunk.toString();
        fullResponse += text;
        yield text;
      }

      // Save assistant's response
      await this.saveMessage(exerciseId, ConversationRole.ASSISTANT, fullResponse);
    } catch (error) {
      console.error('Error streaming from Python service:', error.message);
      throw new Error('Failed to stream response from LLM service');
    }
  }

  async extractCheckpoints(exerciseId: string): Promise<any[]> {
    // Get exercise details
    const exercise = await this.prisma.exercise.findUnique({
      where: { id: exerciseId },
    });

    if (!exercise) {
      throw new NotFoundException(`Exercise with ID ${exerciseId} not found`);
    }

    try {
      // Call Python service to extract checkpoints
      const response = await axios.post(
        `${this.pythonServiceUrl}/llm/extract-checkpoints`,
        {
          exerciseId,
          pdfUrl: exercise.pdfUrl,
        },
        {
          timeout: 60000, // 1 minute timeout
        },
      );

      return response.data.checkpoints || [];
    } catch (error) {
      console.error('Error extracting checkpoints:', error.message);
      throw new Error('Failed to extract checkpoints from LLM service');
    }
  }
}

import { Injectable, NotFoundException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { PrismaService } from "../prisma/prisma.service";
import { ConversationRole, ConversationType } from "@prisma/client";
import axios from "axios";

@Injectable()
export class LlmService {
  private readonly pythonServiceUrl: string;

  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
  ) {
    this.pythonServiceUrl = this.configService.get(
      "PYTHON_SERVICE_URL",
      "http://localhost:8000",
    );
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
      orderBy: { createdAt: "asc" },
    });

    return messages;
  }

  async *streamResponse(
    exerciseId: string,
    message: string,
  ): AsyncGenerator<string> {
    await this.saveMessage(
      exerciseId,
      ConversationRole.PROFESSOR,
      message,
      ConversationType.CHECKPOINT,
    );

    const history = await this.getConversationHistory(
      exerciseId,
      ConversationType.CHECKPOINT,
    );

    const exercise = await this.prisma.exercise.findUnique({
      where: { id: exerciseId },
    });

    if (!exercise) {
      throw new NotFoundException(`Exercise with ID ${exerciseId} not found`);
    }

    const currentCheckpoints = await this.prisma.checkpoint.findMany({
      where: { exerciseId },
      orderBy: { order: "asc" },
    });

    const rules = await this.prisma.rule.findMany({
      where: { exerciseId },
      orderBy: { order: "asc" },
    });

    try {
      const response = await axios.post(
        `${this.pythonServiceUrl}/generate-checkpoints`,
        {
          text: exercise.extractedText ?? "",
          current_checkpoints: JSON.stringify(currentCheckpoints),
          message,
          rules: rules.map((r) => r.content),
          history: history.slice(0, -1).map((msg) => ({
            role: msg.role.toLowerCase(),
            content: msg.content,
          })),
        },
        {
          responseType: "stream",
          timeout: 120000,
        },
      );

      let fullResponse = "";

      for await (const chunk of response.data) {
        const text = chunk.toString();
        fullResponse += text;
        yield text;
      }

      await this.saveMessage(
        exerciseId,
        ConversationRole.ASSISTANT,
        fullResponse,
        ConversationType.CHECKPOINT,
      );
    } catch (error) {
      console.error("Error streaming from Python service:", {
        exerciseId,
        message: error instanceof Error ? error.message : String(error),
      });
      throw new Error("Failed to stream response from LLM service");
    }
  }

  private extractPendingPatterns(
    history: { role: string; content: string }[],
  ): Map<number, string> | null {
    const lastAssistant = [...history]
      .reverse()
      .find((m) => m.role === ConversationRole.ASSISTANT);
    if (!lastAssistant) return null;

    const chunks = lastAssistant.content
      .split(/\n\n/)
      .map((c) => c.replace(/^data:\s*/, "").trim())
      .filter((c) => c && c !== "[DONE]");

    for (const chunk of chunks) {
      try {
        const parsed = JSON.parse(chunk) as {
          type?: string;
          data?: { order: number; pattern: string }[];
        };
        if (parsed.type === "patterns" && Array.isArray(parsed.data)) {
          return new Map(parsed.data.map((p) => [p.order, p.pattern]));
        }
      } catch {
        /* not JSON */
      }
    }

    return null;
  }

  async *streamPatternResponse(
    exerciseId: string,
    message: string,
  ): AsyncGenerator<string> {
    await this.saveMessage(
      exerciseId,
      ConversationRole.PROFESSOR,
      message,
      ConversationType.PATTERN,
    );

    const history = await this.getConversationHistory(
      exerciseId,
      ConversationType.PATTERN,
    );

    const exercise = await this.prisma.exercise.findUnique({
      where: { id: exerciseId },
    });

    if (!exercise) {
      throw new NotFoundException(`Exercise with ID ${exerciseId} not found`);
    }

    const checkpoints = await this.prisma.checkpoint.findMany({
      where: { exerciseId },
      orderBy: { order: "asc" },
    });

    const rules = await this.prisma.rule.findMany({
      where: { exerciseId },
      orderBy: { order: "asc" },
    });

    if (checkpoints.length === 0) {
      throw new NotFoundException(
        `No checkpoints found for exercise ${exerciseId}`,
      );
    }

    // Use patterns from the latest assistant response if the user hasn't accepted yet,
    // so unaccepted changes aren't lost when a follow-up message is sent.
    const pendingPatterns = this.extractPendingPatterns(history.slice(0, -1));

    try {
      const response = await axios.post(
        `${this.pythonServiceUrl}/generate-patterns`,
        {
          checkpoints: checkpoints.map((cp) => ({
            order: cp.order,
            description: cp.description,
            current_pattern: pendingPatterns?.get(cp.order) ?? cp.pattern,
          })),
          message,
          rules: rules.map((r) => r.content),
          database_schema: exercise.databaseSchema ?? undefined,
          history: history.slice(0, -1).map((msg) => ({
            role: msg.role.toLowerCase(),
            content: msg.content,
          })),
        },
        {
          responseType: "stream",
          timeout: 120000,
        },
      );

      let fullResponse = "";

      for await (const chunk of response.data) {
        const text = chunk.toString();
        fullResponse += text;
        yield text;
      }

      await this.saveMessage(
        exerciseId,
        ConversationRole.ASSISTANT,
        fullResponse,
        ConversationType.PATTERN,
      );
    } catch (error) {
      console.error("Error streaming patterns from Python service:", {
        exerciseId,
        message: error instanceof Error ? error.message : String(error),
      });
      throw new Error("Failed to stream pattern response from LLM service");
    }
  }
}

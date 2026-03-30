import {
  Controller,
  Post,
  Body,
  Param,
  Get,
  Query,
  Sse,
  MessageEvent,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { Observable, from } from 'rxjs';
import { concatMap } from 'rxjs/operators';
import { LlmService } from './llm.service';
import { ConversationResponseDto } from './dto/conversation.dto';

@ApiTags('llm')
@Controller('llm')
export class LlmController {
  constructor(private readonly llmService: LlmService) {}

  @Sse('chat')
  @ApiOperation({ summary: 'Stream LLM response for checkpoint extraction' })
  streamCheckpointExtraction(
    @Query('exercise_id') exerciseId: string,
    @Query('message') message: string,
  ): Observable<MessageEvent> {
    return from(this.llmService.streamResponse(exerciseId, message)).pipe(
      concatMap((chunk) => from([{ data: chunk }])),
    );
  }

  @Get('conversations/:exerciseId')
  @ApiOperation({ summary: 'Get conversation history for an exercise' })
  @ApiResponse({ status: 200, description: 'Conversation history', type: [ConversationResponseDto] })
  async getConversations(@Param('exerciseId') exerciseId: string): Promise<ConversationResponseDto[]> {
    return this.llmService.getConversationHistory(exerciseId);
  }

  @Post('extract-checkpoints/:exerciseId')
  @ApiOperation({ summary: 'Extract checkpoints from exercise PDF' })
  @ApiResponse({ status: 200, description: 'Checkpoints extracted' })
  async extractCheckpoints(@Param('exerciseId') exerciseId: string): Promise<{ checkpoints: any[] }> {
    const checkpoints = await this.llmService.extractCheckpoints(exerciseId);
    return { checkpoints };
  }
}

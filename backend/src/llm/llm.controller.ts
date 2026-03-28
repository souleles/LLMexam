import {
  Controller,
  Post,
  Body,
  Param,
  Get,
  Sse,
  MessageEvent,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { Observable, from } from 'rxjs';
import { map, concatMap } from 'rxjs/operators';
import { LlmService } from './llm.service';
import { StreamMessageDto, ConversationResponseDto } from './dto/conversation.dto';

@ApiTags('llm')
@Controller('llm')
export class LlmController {
  constructor(private readonly llmService: LlmService) {}

  @Sse('stream')
  @ApiOperation({ summary: 'Stream LLM response for checkpoint extraction' })
  streamCheckpointExtraction(@Body() streamMessageDto: StreamMessageDto): Observable<MessageEvent> {
    const { exerciseId, message } = streamMessageDto;

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

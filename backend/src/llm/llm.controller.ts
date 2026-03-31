import {
  Controller,
  Get,
  Query,
  Sse,
  MessageEvent,
} from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { Observable, from } from 'rxjs';
import { concatMap } from 'rxjs/operators';
import { LlmService } from './llm.service';

@ApiTags('llm')
@Controller('llm')
export class LlmController {
  constructor(private readonly llmService: LlmService) {}

  @Sse('chat')
  @ApiOperation({ summary: 'Stream LLM response for checkpoint extraction' })
  streamCheckpoints(
    @Query('exercise_id') exerciseId: string,
    @Query('message') message: string,
  ): Observable<MessageEvent> {
    return from(this.llmService.streamResponse(exerciseId, message)).pipe(
      concatMap((chunk) => from([{ data: chunk }])),
    );
  }

  @Sse('chat-patterns')
  @ApiOperation({ summary: 'Stream LLM response for pattern generation' })
  streamPatterns(
    @Query('exercise_id') exerciseId: string,
    @Query('message') message: string,
  ): Observable<MessageEvent> {
    return from(this.llmService.streamPatternResponse(exerciseId, message)).pipe(
      concatMap((chunk) => from([{ data: chunk }])),
    );
  }
}

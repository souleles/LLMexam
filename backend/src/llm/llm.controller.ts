import {
  Controller,
  Get,
  Query,
  Sse,
  MessageEvent,
} from '@nestjs/common';
import { Observable, from } from 'rxjs';
import { concatMap } from 'rxjs/operators';
import { LlmService } from './llm.service';

@Controller('llm')
export class LlmController {
  constructor(private readonly llmService: LlmService) {}

  @Sse('chat')
  streamCheckpoints(
    @Query('exercise_id') exerciseId: string,
    @Query('message') message: string,
  ): Observable<MessageEvent> {
    return from(this.llmService.streamResponse(exerciseId, message)).pipe(
      concatMap((chunk) => from([{ data: chunk }])),
    );
  }

  @Sse('chat-patterns')
  streamPatterns(
    @Query('exercise_id') exerciseId: string,
    @Query('message') message: string,
  ): Observable<MessageEvent> {
    return from(this.llmService.streamPatternResponse(exerciseId, message)).pipe(
      concatMap((chunk) => from([{ data: chunk }])),
    );
  }
}

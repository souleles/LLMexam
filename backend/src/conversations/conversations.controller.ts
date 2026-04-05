import { Body, Controller, Get, Post, Query, UseGuards } from '@nestjs/common';
import { ConversationsService } from './conversations.service';
import { ConversationResponseDto, CreateConversationDto } from './dto/conversation.dto';
import { ConversationType } from '@prisma/client';
import { AuthGuard } from '../auth/guards/auth.guard';

@Controller('conversations')
@UseGuards(AuthGuard)
export class ConversationsController {
  constructor(private readonly conversationsService: ConversationsService) {}

  @Post()
  create(@Body() createConversationDto: CreateConversationDto): Promise<ConversationResponseDto> {
    return this.conversationsService.create(createConversationDto);
  }

  @Get()
  findByExercise(
    @Query('exerciseId') exerciseId: string,
    @Query('type') type?: ConversationType,
  ): Promise<ConversationResponseDto[]> {
    return this.conversationsService.findByExercise(exerciseId, type);
  }
}

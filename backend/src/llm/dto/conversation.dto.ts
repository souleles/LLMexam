import { IsString, IsNotEmpty, IsEnum } from 'class-validator';
import { ConversationRole } from '@prisma/client';

export class CreateConversationDto {
  @IsString()
  @IsNotEmpty()
  exerciseId: string;

  @IsEnum(ConversationRole)
  role: ConversationRole;

  @IsString()
  @IsNotEmpty()
  content: string;
}

export class ConversationResponseDto {
  id: string;
  exerciseId: string;
  role: ConversationRole;
  content: string;
  createdAt: Date;
}

export class StreamMessageDto {
  @IsString()
  @IsNotEmpty()
  exerciseId: string;

  @IsString()
  @IsNotEmpty()
  message: string;
}

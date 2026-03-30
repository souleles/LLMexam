import { IsString, IsNotEmpty, IsEnum } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { ConversationRole as PrismaConversationRole } from '@prisma/client';

export class CreateConversationDto {
  @IsString()
  @IsNotEmpty()
  exerciseId: string;

  @IsEnum(PrismaConversationRole)
  role: PrismaConversationRole;

  @IsString()
  @IsNotEmpty()
  content: string;
}

export class ConversationResponseDto {
  id: string;
  exerciseId: string;
  role: 'professor' | 'assistant';
  content: string;
  createdAt: string;
}

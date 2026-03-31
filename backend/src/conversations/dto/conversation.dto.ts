import { IsString, IsNotEmpty, IsEnum, IsOptional } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ConversationRole as PrismaConversationRole, ConversationType } from '@prisma/client';

export class CreateConversationDto {
  @IsString()
  @IsNotEmpty()
  exerciseId: string;

  @IsEnum(PrismaConversationRole)
  role: PrismaConversationRole;

  @IsString()
  @IsNotEmpty()
  content: string;

  @IsEnum(ConversationType)
  @IsOptional()
  type?: ConversationType;
}

export class ConversationResponseDto {
  id: string;
  exerciseId: string;
  role: 'professor' | 'assistant';
  type: 'CHECKPOINT' | 'PATTERN';
  content: string;
  createdAt: string;
}

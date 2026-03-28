import { IsString, IsNotEmpty, IsEnum } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { ConversationRole as PrismaConversationRole } from '@prisma/client';

export class CreateConversationDto {
  @ApiProperty({ description: 'Exercise ID' })
  @IsString()
  @IsNotEmpty()
  exerciseId: string;

  @ApiProperty({ enum: PrismaConversationRole, description: 'Message role' })
  @IsEnum(PrismaConversationRole)
  role: PrismaConversationRole;

  @ApiProperty({ description: 'Message content' })
  @IsString()
  @IsNotEmpty()
  content: string;
}

export class ConversationResponseDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  exerciseId: string;

  @ApiProperty({ enum: ['professor', 'assistant'] })
  role: 'professor' | 'assistant';

  @ApiProperty()
  content: string;

  @ApiProperty()
  createdAt: string;
}

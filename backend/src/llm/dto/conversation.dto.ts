import { IsString, IsNotEmpty, IsEnum } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { ConversationRole } from '@prisma/client';

export class CreateConversationDto {
  @ApiProperty({ description: 'Exercise ID' })
  @IsString()
  @IsNotEmpty()
  exerciseId: string;

  @ApiProperty({ enum: ConversationRole })
  @IsEnum(ConversationRole)
  role: ConversationRole;

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

  @ApiProperty({ enum: ConversationRole })
  role: ConversationRole;

  @ApiProperty()
  content: string;

  @ApiProperty()
  createdAt: Date;
}

export class StreamMessageDto {
  @ApiProperty({ description: 'Exercise ID' })
  @IsString()
  @IsNotEmpty()
  exerciseId: string;

  @ApiProperty({ description: 'User message' })
  @IsString()
  @IsNotEmpty()
  message: string;
}

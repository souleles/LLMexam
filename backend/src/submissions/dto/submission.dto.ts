import { IsString, IsNotEmpty } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateSubmissionDto {
  @ApiProperty({ description: 'Exercise ID' })
  @IsString()
  @IsNotEmpty()
  exerciseId: string;

  @ApiProperty({ description: 'Student name or identifier' })
  @IsString()
  @IsNotEmpty()
  studentName: string;

  @ApiProperty({ description: 'File name' })
  @IsString()
  @IsNotEmpty()
  fileName: string;

  @ApiProperty({ description: 'File URL or path' })
  @IsString()
  @IsNotEmpty()
  fileUrl: string;

  @ApiProperty({ description: 'File type/extension' })
  @IsString()
  @IsNotEmpty()
  fileType: string;

  @ApiProperty({ description: 'Extracted file content' })
  @IsString()
  @IsNotEmpty()
  content: string;
}

export class SubmissionResponseDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  exerciseId: string;

  @ApiProperty()
  studentName: string;

  @ApiProperty()
  fileName: string;

  @ApiProperty()
  fileUrl: string;

  @ApiProperty()
  fileType: string;

  @ApiProperty()
  content: string;

  @ApiProperty()
  createdAt: Date;

  @ApiProperty()
  updatedAt: Date;

  @ApiProperty({ required: false })
  gradingResult?: {
    id: string;
    score: number;
    passed: boolean;
    totalCheckpoints: number;
    passedCheckpoints: number;
  };
}

import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Delete,
  UseInterceptors,
  UploadedFiles,
  BadRequestException,
  Query,
} from '@nestjs/common';
import { FilesInterceptor } from '@nestjs/platform-express';
import { ApiTags, ApiOperation, ApiResponse, ApiConsumes, ApiBody } from '@nestjs/swagger';
import { diskStorage } from 'multer';
import { extname } from 'path';
import { SubmissionsService } from './submissions.service';
import { CreateSubmissionDto, SubmissionResponseDto } from './dto/submission.dto';

const ALLOWED_EXTENSIONS = ['.sql', '.txt', '.py', '.pdf', '.docx', '.js', '.ts', '.tsx'];

@ApiTags('submissions')
@Controller('submissions')
export class SubmissionsController {
  constructor(private readonly submissionsService: SubmissionsService) {}

  @Post()
  @UseInterceptors(
    FilesInterceptor('files', 10, {
      storage: diskStorage({
        destination: './uploads/submissions',
        filename: (req, file, callback) => {
          const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
          const ext = extname(file.originalname);
          callback(null, `submission-${uniqueSuffix}${ext}`);
        },
      }),
      fileFilter: (req, file, callback) => {
        const ext = extname(file.originalname).toLowerCase();
        if (!ALLOWED_EXTENSIONS.includes(ext)) {
          return callback(
            new BadRequestException(
              `File type not allowed. Allowed types: ${ALLOWED_EXTENSIONS.join(', ')}`,
            ),
            false,
          );
        }
        callback(null, true);
      },
      limits: {
        fileSize: 10 * 1024 * 1024, // 10MB
      },
    }),
  )
  @ApiOperation({ summary: 'Upload multiple student submission files' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        files: {
          type: 'array',
          items: {
            type: 'string',
            format: 'binary',
          },
        },
        exerciseId: {
          type: 'string',
        },
      },
    },
  })
  @ApiResponse({ status: 201, description: 'Files uploaded and submissions created', type: [SubmissionResponseDto] })
  async uploadSubmissions(
    @UploadedFiles() files: Express.Multer.File[],
    @Body('exerciseId') exerciseId: string,
  ): Promise<SubmissionResponseDto[]> {
    if (!files || files.length === 0) {
      throw new BadRequestException('At least one file is required');
    }

    if (!exerciseId) {
      throw new BadRequestException('Exercise ID is required');
    }

    return this.submissionsService.uploadMultiple(exerciseId, files);
  }

  @Get()
  @ApiOperation({ summary: 'Get all submissions, optionally filtered by exercise' })
  @ApiResponse({ status: 200, description: 'List of submissions', type: [SubmissionResponseDto] })
  findAll(@Query('exerciseId') exerciseId?: string): Promise<SubmissionResponseDto[]> {
    if (exerciseId) {
      return this.submissionsService.findByExercise(exerciseId);
    }
    return this.submissionsService.findAll();
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get submission by ID' })
  @ApiResponse({ status: 200, description: 'Submission details', type: SubmissionResponseDto })
  @ApiResponse({ status: 404, description: 'Submission not found' })
  findOne(@Param('id') id: string): Promise<SubmissionResponseDto> {
    return this.submissionsService.findOne(id);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete submission' })
  @ApiResponse({ status: 200, description: 'Submission deleted' })
  @ApiResponse({ status: 404, description: 'Submission not found' })
  async remove(@Param('id') id: string): Promise<{ message: string }> {
    await this.submissionsService.remove(id);
    return { message: 'Submission deleted successfully' };
  }
}

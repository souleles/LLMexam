import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Query,
  UploadedFiles,
  UseInterceptors,
} from '@nestjs/common';
import { FilesInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { extname } from 'path';
import { SubmissionResponseDto } from './dto/submission.dto';
import { SubmissionsService } from './submissions.service';

const ALLOWED_EXTENSIONS = ['.sql', '.txt', '.py', '.pdf', '.docx', '.js', '.ts', '.tsx'];

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
  findAll(@Query('exerciseId') exerciseId?: string): Promise<SubmissionResponseDto[]> {
    if (exerciseId) {
      return this.submissionsService.findByExercise(exerciseId);
    }
    return this.submissionsService.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string): Promise<SubmissionResponseDto> {
    return this.submissionsService.findOne(id);
  }

  @Delete(':id')
  async remove(@Param('id') id: string): Promise<{ message: string }> {
    await this.submissionsService.remove(id);
    return { message: 'Submission deleted successfully' };
  }
}

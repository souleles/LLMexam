import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Query,
  UploadedFile,
  UseInterceptors,
  UseGuards,
  ParseEnumPipe,
  DefaultValuePipe,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { extname } from 'path';
import { CheckpointMatch, SubmissionsService } from './submissions.service';
import { AuthGuard } from '../auth/guards/auth.guard';

const ALLOWED_EXTENSIONS = ['.sql', '.txt', '.py', '.pdf', '.docx', '.js', '.ts', '.tsx', '.zip', '.rar'];

const multerConfig = {
  storage: diskStorage({
    destination: './uploads/submissions',
    filename: (req, file, callback) => {
      const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
      const ext = extname(file.originalname);
      callback(null, `submission-${uniqueSuffix}${ext}`);
    },
  }),
  fileFilter: (
    req: Express.Request, 
    file: Express.Multer.File, 
    callback: (error: Error | null, accept: boolean) => void
  ) => {
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
    fileSize: 50 * 1024 * 1024, // 50MB for ZIP files
  },
};

@Controller('submissions')
@UseGuards(AuthGuard)
export class SubmissionsController {
  constructor(private readonly submissionsService: SubmissionsService) {}

  @Post('upload-and-grade')
  @UseInterceptors(FileInterceptor('file', multerConfig))
  async uploadAndGrade(
    @Body('exerciseId') exerciseId: string,
    @Body('studentId') rawStudentId: string | string[],
    @UploadedFile() file: Express.Multer.File,
    @Query('method', new DefaultValuePipe('regex')) method: string,
  ): Promise<{ checkpoints: CheckpointMatch[]; submissionId: string; method: 'regex' | 'llm' }> {
    if (!file) {
      throw new BadRequestException('No file uploaded');
    }

    if (!exerciseId || !rawStudentId) {
      throw new BadRequestException('exerciseId and studentId are required');
    }

    const gradingMethod = method === 'llm' ? 'llm' : 'regex';
    const studentIds = Array.isArray(rawStudentId) ? rawStudentId : [rawStudentId];

    return this.submissionsService.uploadAndGradeZip(exerciseId, studentIds, file, gradingMethod);
  }

  @Get()
  findAll(
    @Query('studentId') studentId?: string,
    @Query('exerciseId') exerciseId?: string,
  ) {
    if (studentId && exerciseId) {
      throw new BadRequestException('Provide either studentId or exerciseId, not both');
    }
    if (!studentId && !exerciseId) {
      throw new BadRequestException('Either studentId or exerciseId is required');
    }
    if (studentId) {
      return this.submissionsService.findByStudent(studentId);
    }
    return this.submissionsService.findByExercise(exerciseId!);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.submissionsService.findOne(id);
  }

  @Delete(':id')
  async remove(@Param('id') id: string): Promise<{ message: string }> {
    await this.submissionsService.remove(id);
    return { message: 'Submission deleted successfully' };
  }
}

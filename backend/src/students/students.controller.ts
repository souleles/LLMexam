import {
  BadRequestException,
  Controller,
  Get,
  Post,
  Param,
  UploadedFile,
  UseInterceptors,
  UseGuards,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { StudentResponseDto } from './dto/student.dto';
import { StudentsService } from './students.service';
import { AuthGuard } from '../auth/guards/auth.guard';
import { AuthorizedUser } from '@/auth/dto/AuthorizedUser';
import { AuthUser } from '@/auth/decorators/AuthUser';

const ALLOWED_EXTENSIONS = ['.csv', '.xlsx', '.xls'];

@Controller('students')
@UseGuards(AuthGuard)
export class StudentsController {
  constructor(private readonly studentsService: StudentsService) {}

  @Post('upload')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: memoryStorage(),
      fileFilter: (req, file, callback) => {
        const ext = file.originalname.slice(file.originalname.lastIndexOf('.')).toLowerCase();
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
      limits: { fileSize: 10 * 1024 * 1024 },
    }),
  )
  async upload(
    @UploadedFile() file: Express.Multer.File,
    @AuthUser() user: AuthorizedUser
  ): Promise<StudentResponseDto[]> {
    if (!file) {
      throw new BadRequestException('No file uploaded');
    }
    return this.studentsService.importFromFile(file, user.sub);
  }

  @Get()
  findAll(@AuthUser() user: AuthorizedUser): Promise<StudentResponseDto[]> {
    return this.studentsService.findAll(user.sub);
  }

  @Get(':id')
  findOne(@Param('id') id: string): Promise<StudentResponseDto> {
    return this.studentsService.findOne(id);
  }

  @Get(':id/mini-report')
  getMiniReport(@Param('id') id: string) {
    return this.studentsService.getMiniReport(id);
  }
}

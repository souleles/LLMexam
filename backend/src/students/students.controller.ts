import {
  BadRequestException,
  Controller,
  Get,
  Post,
  Param,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { StudentResponseDto } from './dto/student.dto';
import { StudentsService } from './students.service';

const ALLOWED_EXTENSIONS = ['.csv', '.xlsx', '.xls'];

@Controller('students')
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
  ): Promise<StudentResponseDto[]> {
    if (!file) {
      throw new BadRequestException('No file uploaded');
    }
    return this.studentsService.importFromFile(file);
  }

  @Get()
  findAll(): Promise<StudentResponseDto[]> {
    return this.studentsService.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string): Promise<StudentResponseDto> {
    return this.studentsService.findOne(id);
  }

  @Get(':id/submissions')
  getStudentSubmissions(@Param('id') id: string) {
    return this.studentsService.getStudentSubmissions(id);
  }
}

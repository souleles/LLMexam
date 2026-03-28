import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { extname } from 'path';
import { CreateExerciseDto, ExerciseResponseDto, UpdateExerciseDto } from './dto/exercise.dto';
import { ExercisesService } from './exercises.service';

@Controller('exercises')
export class ExercisesController {
  constructor(private readonly exercisesService: ExercisesService) {}

  @Post()
  create(@Body() createExerciseDto: CreateExerciseDto): Promise<ExerciseResponseDto> {
    return this.exercisesService.create(createExerciseDto);
  }

  @Post('upload')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: diskStorage({
        destination: './uploads/exercises',
        filename: (req, file, callback) => {
          const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
          const ext = extname(file.originalname);
          callback(null, `exercise-${uniqueSuffix}${ext}`);
        },
      }),
      fileFilter: (req, file, callback) => {
        if (file.mimetype !== 'application/pdf') {
          return callback(new BadRequestException('Only PDF files are allowed'), false);
        }
        callback(null, true);
      },
      limits: {
        fileSize: 10 * 1024 * 1024, // 10MB
      },
    }),
  )
  async uploadExercise(
    @UploadedFile() file: Express.Multer.File,
    @Body('title') title: string,
  ): Promise<ExerciseResponseDto> {
    if (!file) {
      throw new BadRequestException('File is required');
    }

    if (!title) {
      throw new BadRequestException('Title is required');
    }

    const pdfUrl = `/uploads/exercises/${file.filename}`;
    return this.exercisesService.create({ title, pdfUrl });
  }

  @Get()
  findAll(): Promise<ExerciseResponseDto[]> {
    return this.exercisesService.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string): Promise<ExerciseResponseDto> {
    return this.exercisesService.findOne(id);
  }

  @Patch(':id')
  update(
    @Param('id') id: string,
    @Body() updateExerciseDto: UpdateExerciseDto,
  ): Promise<ExerciseResponseDto> {
    return this.exercisesService.update(id, updateExerciseDto);
  }

  @Patch(':id/approve')
  approve(@Param('id') id: string): Promise<ExerciseResponseDto> {
    return this.exercisesService.approve(id);
  }

  @Delete(':id')
  async remove(@Param('id') id: string): Promise<{ message: string }> {
    await this.exercisesService.remove(id);
    return { message: 'Exercise deleted successfully' };
  }
}

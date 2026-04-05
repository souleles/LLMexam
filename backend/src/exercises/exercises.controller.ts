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
  UseGuards,
} from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { extname } from 'path';
import { firstValueFrom } from 'rxjs';
import * as fs from 'fs';
import * as FormData from 'form-data';
import { CreateExerciseDto, ExerciseResponseDto, UpdateExerciseDto } from './dto/exercise.dto';
import { ExercisesService } from './exercises.service';
import { AuthGuard } from '../auth/guards/auth.guard';

@Controller('exercises')
@UseGuards(AuthGuard)
export class ExercisesController {
  private readonly pythonServiceUrl: string;

  constructor(
    private readonly exercisesService: ExercisesService,
    private readonly httpService: HttpService,
    private readonly configService: ConfigService,
  ) {
    this.pythonServiceUrl = this.configService.get('PYTHON_SERVICE_URL', 'http://localhost:8000');
  }

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

    // Extract text from PDF via Python service
    let extractedText: string | undefined;
    try {
      const formData = new FormData();
      formData.append('file', fs.createReadStream(file.path), {
        filename: file.originalname,
        contentType: 'application/pdf',
      });

      const { data } = await firstValueFrom(
        this.httpService.post(`${this.pythonServiceUrl}/extract-pdf`, formData, {
          headers: formData.getHeaders(),
        }),
      );
      extractedText = data.extracted_text;
    } catch (err) {
      // Non-fatal: exercise is still created, but LLM chat won't have context
      console.error('PDF extraction failed:', err.message);
    }

    return this.exercisesService.create({ title, pdfUrl, extractedText });
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

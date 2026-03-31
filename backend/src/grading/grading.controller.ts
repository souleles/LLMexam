import { Controller, Post, Get, Param, Query, Body } from '@nestjs/common';
import { GradingService } from './grading.service';
import { GradingResultResponseDto, ExerciseGradingResultsDto, CheckpointResultDto } from './dto/grading.dto';

@Controller('grading')
export class GradingController {
  constructor(private readonly gradingService: GradingService) {}

  @Post('submission/:submissionId')
  gradeSubmission(@Param('submissionId') submissionId: string): Promise<GradingResultResponseDto> {
    return this.gradingService.gradeSubmission(submissionId);
  }

  @Post('exercise/:exerciseId')
  gradeAllSubmissions(@Param('exerciseId') exerciseId: string): Promise<ExerciseGradingResultsDto> {
    return this.gradingService.gradeAllSubmissions(exerciseId);
  }

  @Get('exercise/:exerciseId')
  getExerciseResults(@Param('exerciseId') exerciseId: string): Promise<ExerciseGradingResultsDto> {
    return this.gradingService.getExerciseResults(exerciseId);
  }

  @Get('submission/:submissionId')
  getSubmissionResult(@Param('submissionId') submissionId: string): Promise<GradingResultResponseDto> {
    return this.gradingService.getSubmissionResult(submissionId);
  }

  @Post(':submissionId')
  async gradeSubmissionDetailed(@Param('submissionId') submissionId: string): Promise<CheckpointResultDto[]> {
    return this.gradingService.gradeSubmissionDetailed(submissionId);
  }
  @Get('results')
  async getResults(@Query('exerciseId') exerciseId: string): Promise<CheckpointResultDto[]> {
    return this.gradingService.getAllResults(exerciseId);
  }

  @Post('results')
  async saveResults(@Body() results: CheckpointResultDto[]): Promise<{ message: string }> {
    await this.gradingService.saveResults(results);
    return { message: 'Results saved successfully' };
  }
}

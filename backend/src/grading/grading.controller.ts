import { Controller, Post, Get, Param, Query, Body } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { GradingService } from './grading.service';
import { GradingResultResponseDto, ExerciseGradingResultsDto, CheckpointResultDto } from './dto/grading.dto';

@ApiTags('grading')
@Controller('grading')
export class GradingController {
  constructor(private readonly gradingService: GradingService) {}

  @Post('submission/:submissionId')
  @ApiOperation({ summary: 'Grade a single submission' })
  @ApiResponse({ status: 200, description: 'Submission graded', type: GradingResultResponseDto })
  @ApiResponse({ status: 404, description: 'Submission not found' })
  gradeSubmission(@Param('submissionId') submissionId: string): Promise<GradingResultResponseDto> {
    return this.gradingService.gradeSubmission(submissionId);
  }

  @Post('exercise/:exerciseId')
  @ApiOperation({ summary: 'Grade all submissions for an exercise' })
  @ApiResponse({ status: 200, description: 'All submissions graded', type: ExerciseGradingResultsDto })
  @ApiResponse({ status: 404, description: 'Exercise not found' })
  gradeAllSubmissions(@Param('exerciseId') exerciseId: string): Promise<ExerciseGradingResultsDto> {
    return this.gradingService.gradeAllSubmissions(exerciseId);
  }

  @Get('exercise/:exerciseId')
  @ApiOperation({ summary: 'Get grading results for an exercise' })
  @ApiResponse({ status: 200, description: 'Grading results', type: ExerciseGradingResultsDto })
  @ApiResponse({ status: 404, description: 'Exercise not found' })
  getExerciseResults(@Param('exerciseId') exerciseId: string): Promise<ExerciseGradingResultsDto> {
    return this.gradingService.getExerciseResults(exerciseId);
  }

  @Get('submission/:submissionId')
  @ApiOperation({ summary: 'Get grading result for a submission' })
  @ApiResponse({ status: 200, description: 'Grading result', type: GradingResultResponseDto })
  @ApiResponse({ status: 404, description: 'Grading result not found' })
  getSubmissionResult(@Param('submissionId') submissionId: string): Promise<GradingResultResponseDto> {
    return this.gradingService.getSubmissionResult(submissionId);
  }

  @Post(':submissionId')
  @ApiOperation({ summary: 'Grade a single submission and return detailed checkpoint results' })
  @ApiResponse({ status: 200, description: 'Checkpoint results', type: [CheckpointResultDto] })
  @ApiResponse({ status: 404, description: 'Submission not found' })
  async gradeSubmissionDetailed(@Param('submissionId') submissionId: string): Promise<CheckpointResultDto[]> {
    return this.gradingService.gradeSubmissionDetailed(submissionId);
  }

  @Get('results')
  @ApiOperation({ summary: 'Get grading results filtered by exerciseId' })
  @ApiResponse({ status: 200, description: 'Grading results', type: [CheckpointResultDto] })
  async getResults(@Query('exerciseId') exerciseId: string): Promise<CheckpointResultDto[]> {
    return this.gradingService.getAllResults(exerciseId);
  }

  @Post('results')
  @ApiOperation({ summary: 'Save grading results' })
  @ApiResponse({ status: 201, description: 'Results saved' })
  async saveResults(@Body() results: CheckpointResultDto[]): Promise<{ message: string }> {
    await this.gradingService.saveResults(results);
    return { message: 'Results saved successfully' };
  }
}

import { Controller, Post, Get, Param, Query, Body, Patch, UseGuards } from '@nestjs/common';
import { GradingService } from './grading.service';
import { GradingResultResponseDto, CheckpointResultDto, UpdateTeacherAcceptedDto } from './dto/grading.dto';
import { AuthGuard } from '../auth/guards/auth.guard';

@Controller('grading')
@UseGuards(AuthGuard)
export class GradingController {
  constructor(private readonly gradingService: GradingService) {}

  @Get('results')
  async getResults(@Query('exerciseId') exerciseId: string): Promise<CheckpointResultDto[]> {
    return this.gradingService.getAllResults(exerciseId);
  }
  @Post('results')
  async saveResults(@Body() results: CheckpointResultDto[]): Promise<{ message: string }> {
    await this.gradingService.saveResults(results);
    return { message: 'Results saved successfully' };
  }

  @Patch('checkpoint-result/:id/teacher-accepted')
  async updateCheckpointTeacherAccepted(
    @Param('id') id: string,
    @Body() dto: UpdateTeacherAcceptedDto,
  ): Promise<GradingResultResponseDto> {
    return this.gradingService.updateCheckpointTeacherAccepted(id, dto);
  }
}

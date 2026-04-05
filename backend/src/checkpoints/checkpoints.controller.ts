import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  Query,
  UseGuards,
} from '@nestjs/common';
import { CheckpointsService } from './checkpoints.service';
import { CreateCheckpointDto, UpdateCheckpointDto, CheckpointResponseDto } from './dto/checkpoint.dto';
import { AuthGuard } from '../auth/guards/auth.guard';

@Controller('checkpoints')
@UseGuards(AuthGuard)
export class CheckpointsController {
  constructor(private readonly checkpointsService: CheckpointsService) {}

  @Post()
  create(@Body() createCheckpointDto: CreateCheckpointDto): Promise<CheckpointResponseDto> {
    return this.checkpointsService.create(createCheckpointDto);
  }

  @Post('bulk/:exerciseId')
  createMany(
    @Param('exerciseId') exerciseId: string,
    @Body() checkpoints: Omit<CreateCheckpointDto, 'exerciseId'>[],
  ): Promise<CheckpointResponseDto[]> {
    return this.checkpointsService.createMany(exerciseId, checkpoints);
  }

  @Get()
  findAll(@Query('exerciseId') exerciseId?: string): Promise<CheckpointResponseDto[]> {
    if (exerciseId) {
      return this.checkpointsService.findByExercise(exerciseId);
    }
    return this.checkpointsService.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string): Promise<CheckpointResponseDto> {
    return this.checkpointsService.findOne(id);
  }

  @Patch(':id')
  update(
    @Param('id') id: string,
    @Body() updateCheckpointDto: UpdateCheckpointDto,
  ): Promise<CheckpointResponseDto> {
    return this.checkpointsService.update(id, updateCheckpointDto);
  }

  @Delete(':id')
  async remove(@Param('id') id: string): Promise<{ message: string }> {
    await this.checkpointsService.remove(id);
    return { message: 'Checkpoint deleted successfully' };
  }

  @Patch('bulk-patterns/:exerciseId')
  bulkUpdatePatterns(
    @Param('exerciseId') exerciseId: string,
    @Body() patterns: { order: number; pattern: string }[],
  ): Promise<CheckpointResponseDto[]> {
    return this.checkpointsService.bulkUpdatePatterns(exerciseId, patterns);
  }
}

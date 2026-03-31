import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  Query,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { CheckpointsService } from './checkpoints.service';
import { CreateCheckpointDto, UpdateCheckpointDto, CheckpointResponseDto } from './dto/checkpoint.dto';

@ApiTags('checkpoints')
@Controller('checkpoints')
export class CheckpointsController {
  constructor(private readonly checkpointsService: CheckpointsService) {}

  @Post()
  @ApiOperation({ summary: 'Create a new checkpoint' })
  @ApiResponse({ status: 201, description: 'Checkpoint created', type: CheckpointResponseDto })
  create(@Body() createCheckpointDto: CreateCheckpointDto): Promise<CheckpointResponseDto> {
    return this.checkpointsService.create(createCheckpointDto);
  }
  @Post('bulk/:exerciseId')
  @ApiOperation({ summary: 'Create multiple checkpoints for an exercise' })
  @ApiResponse({ status: 201, description: 'Checkpoints created', type: [CheckpointResponseDto] })
  createMany(
    @Param('exerciseId') exerciseId: string,
    @Body() checkpoints: Omit<CreateCheckpointDto, 'exerciseId'>[],
  ): Promise<CheckpointResponseDto[]> {
    return this.checkpointsService.createMany(exerciseId, checkpoints);
  }

  @Get()
  @ApiOperation({ summary: 'Get all checkpoints, optionally filtered by exercise' })
  @ApiResponse({ status: 200, description: 'List of checkpoints', type: [CheckpointResponseDto] })
  findAll(@Query('exerciseId') exerciseId?: string): Promise<CheckpointResponseDto[]> {
    if (exerciseId) {
      return this.checkpointsService.findByExercise(exerciseId);
    }
    return this.checkpointsService.findAll();
  }

  @Get('exercise/:exerciseId')
  @ApiOperation({ summary: 'Get all checkpoints for an exercise' })
  @ApiResponse({ status: 200, description: 'List of checkpoints', type: [CheckpointResponseDto] })
  findByExercise(@Param('exerciseId') exerciseId: string): Promise<CheckpointResponseDto[]> {
    return this.checkpointsService.findByExercise(exerciseId);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get checkpoint by ID' })
  @ApiResponse({ status: 200, description: 'Checkpoint details', type: CheckpointResponseDto })
  @ApiResponse({ status: 404, description: 'Checkpoint not found' })
  findOne(@Param('id') id: string): Promise<CheckpointResponseDto> {
    return this.checkpointsService.findOne(id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update checkpoint' })
  @ApiResponse({ status: 200, description: 'Checkpoint updated', type: CheckpointResponseDto })
  @ApiResponse({ status: 404, description: 'Checkpoint not found' })
  update(
    @Param('id') id: string,
    @Body() updateCheckpointDto: UpdateCheckpointDto,
  ): Promise<CheckpointResponseDto> {
    return this.checkpointsService.update(id, updateCheckpointDto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete checkpoint' })
  @ApiResponse({ status: 200, description: 'Checkpoint deleted' })
  @ApiResponse({ status: 404, description: 'Checkpoint not found' })
  async remove(@Param('id') id: string): Promise<{ message: string }> {
    await this.checkpointsService.remove(id);
    return { message: 'Checkpoint deleted successfully' };
  }

  @Post('approve')
  @ApiOperation({ summary: 'Approve checkpoints for an exercise' })
  @ApiResponse({ status: 200, description: 'Checkpoints approved' })
  async approveCheckpoints(@Body('exerciseId') exerciseId: string): Promise<{ message: string }> {
    return { message: 'Checkpoints approved successfully' };
  }

  @Patch('bulk-patterns/:exerciseId')
  @ApiOperation({ summary: 'Bulk update patterns for all checkpoints in an exercise' })
  @ApiResponse({ status: 200, description: 'Patterns updated', type: [CheckpointResponseDto] })
  bulkUpdatePatterns(
    @Param('exerciseId') exerciseId: string,
    @Body() patterns: { order: number; pattern: string }[],
  ): Promise<CheckpointResponseDto[]> {
    return this.checkpointsService.bulkUpdatePatterns(exerciseId, patterns);
  }
}

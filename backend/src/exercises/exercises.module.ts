import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { ConfigModule } from '@nestjs/config';
import { ExercisesService } from './exercises.service';
import { ExercisesController } from './exercises.controller';

@Module({
  imports: [HttpModule, ConfigModule],
  controllers: [ExercisesController],
  providers: [ExercisesService],
  exports: [ExercisesService],
})
export class ExercisesModule {}

import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ThrottlerModule } from '@nestjs/throttler';
import { PrismaModule } from './prisma/prisma.module';
import { ExercisesModule } from './exercises/exercises.module';
import { CheckpointsModule } from './checkpoints/checkpoints.module';
import { SubmissionsModule } from './submissions/submissions.module';
import { GradingModule } from './grading/grading.module';
import { LlmModule } from './llm/llm.module';
import { ConversationsModule } from './conversations/conversations.module';
import { StudentsModule } from './students/students.module';
import { AuthController } from './auth/auth.controller';
import { AuthModule } from './auth/auth.module';
import { JwtModule } from '@nestjs/jwt';

@Module({
  imports: [
    // jwt
    JwtModule.register({
      global: true,
      secret: process.env.JWT_SECRET,
    }),
    // Configuration
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),
    // Rate limiting
    ThrottlerModule.forRoot([{
      ttl: 60000, // 60 seconds
      limit: 100, // 100 requests per TTL
    }]),
    // Database
    PrismaModule,
    // Feature modules
    ExercisesModule,
    CheckpointsModule,
    SubmissionsModule,
    GradingModule,
    LlmModule,
    ConversationsModule,
    StudentsModule,
    AuthModule
  ],
})
export class AppModule {}

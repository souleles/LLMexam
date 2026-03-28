import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  constructor() {
    super({
      log: ['error', 'warn'],
    });
  }

  async onModuleInit() {
    await this.$connect();
    console.log('✅ Database connected');
  }

  async onModuleDestroy() {
    await this.$disconnect();
    console.log('❌ Database disconnected');
  }

  async cleanDatabase() {
    // Clean all tables in the correct order (respecting foreign keys)
    await this.$transaction([
      this.checkpointResult.deleteMany(),
      this.gradingResult.deleteMany(),
      this.submission.deleteMany(),
      this.conversation.deleteMany(),
      this.checkpoint.deleteMany(),
      this.exercise.deleteMany(),
    ]);
  }
}

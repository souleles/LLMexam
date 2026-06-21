-- CreateEnum
CREATE TYPE "ConversationType" AS ENUM ('CHECKPOINT', 'PATTERN');

-- AlterTable
ALTER TABLE "conversations" ADD COLUMN "type" "ConversationType" NOT NULL DEFAULT 'CHECKPOINT';

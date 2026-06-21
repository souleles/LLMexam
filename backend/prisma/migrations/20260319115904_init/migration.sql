-- CreateEnum
CREATE TYPE "ExerciseStatus" AS ENUM ('DRAFT', 'APPROVED', 'GRADED');

-- CreateEnum
CREATE TYPE "ConversationRole" AS ENUM ('PROFESSOR', 'ASSISTANT');

-- CreateTable
CREATE TABLE "exercises" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "pdfUrl" TEXT NOT NULL,
    "status" "ExerciseStatus" NOT NULL DEFAULT 'DRAFT',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "exercises_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "checkpoints" (
    "id" TEXT NOT NULL,
    "exerciseId" TEXT NOT NULL,
    "order" INTEGER NOT NULL,
    "description" TEXT NOT NULL,
    "pattern" TEXT NOT NULL,
    "caseSensitive" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "checkpoints_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "conversations" (
    "id" TEXT NOT NULL,
    "exerciseId" TEXT NOT NULL,
    "role" "ConversationRole" NOT NULL,
    "content" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "conversations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "submissions" (
    "id" TEXT NOT NULL,
    "exerciseId" TEXT NOT NULL,
    "studentName" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "fileUrl" TEXT NOT NULL,
    "fileType" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "submissions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "grading_results" (
    "id" TEXT NOT NULL,
    "submissionId" TEXT NOT NULL,
    "totalCheckpoints" INTEGER NOT NULL,
    "passedCheckpoints" INTEGER NOT NULL,
    "score" DOUBLE PRECISION NOT NULL,
    "passed" BOOLEAN NOT NULL,
    "gradedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "grading_results_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "checkpoint_results" (
    "id" TEXT NOT NULL,
    "gradingResultId" TEXT NOT NULL,
    "checkpointId" TEXT NOT NULL,
    "matched" BOOLEAN NOT NULL,
    "matchedSnippets" TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "checkpoint_results_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "checkpoints_exerciseId_idx" ON "checkpoints"("exerciseId");

-- CreateIndex
CREATE INDEX "conversations_exerciseId_idx" ON "conversations"("exerciseId");

-- CreateIndex
CREATE INDEX "submissions_exerciseId_idx" ON "submissions"("exerciseId");

-- CreateIndex
CREATE UNIQUE INDEX "grading_results_submissionId_key" ON "grading_results"("submissionId");

-- CreateIndex
CREATE INDEX "checkpoint_results_gradingResultId_idx" ON "checkpoint_results"("gradingResultId");

-- CreateIndex
CREATE INDEX "checkpoint_results_checkpointId_idx" ON "checkpoint_results"("checkpointId");

-- AddForeignKey
ALTER TABLE "checkpoints" ADD CONSTRAINT "checkpoints_exerciseId_fkey" FOREIGN KEY ("exerciseId") REFERENCES "exercises"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "conversations" ADD CONSTRAINT "conversations_exerciseId_fkey" FOREIGN KEY ("exerciseId") REFERENCES "exercises"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "submissions" ADD CONSTRAINT "submissions_exerciseId_fkey" FOREIGN KEY ("exerciseId") REFERENCES "exercises"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "grading_results" ADD CONSTRAINT "grading_results_submissionId_fkey" FOREIGN KEY ("submissionId") REFERENCES "submissions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "checkpoint_results" ADD CONSTRAINT "checkpoint_results_gradingResultId_fkey" FOREIGN KEY ("gradingResultId") REFERENCES "grading_results"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "checkpoint_results" ADD CONSTRAINT "checkpoint_results_checkpointId_fkey" FOREIGN KEY ("checkpointId") REFERENCES "checkpoints"("id") ON DELETE CASCADE ON UPDATE CASCADE;

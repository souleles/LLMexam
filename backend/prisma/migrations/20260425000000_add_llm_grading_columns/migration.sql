-- AlterTable: add LLM score columns to grading_results
ALTER TABLE "grading_results" ADD COLUMN "llmPassedCheckpoints" INTEGER;
ALTER TABLE "grading_results" ADD COLUMN "llmScore" DOUBLE PRECISION;

-- AlterTable: add LLM match columns to checkpoint_results
ALTER TABLE "checkpoint_results" ADD COLUMN "llmMatched" BOOLEAN;
ALTER TABLE "checkpoint_results" ADD COLUMN "llmMatchedSnippets" TEXT[] NOT NULL DEFAULT '{}';

-- CreateIndex: unique constraint for upsert support
CREATE UNIQUE INDEX "checkpoint_results_gradingResultId_checkpointId_key" ON "checkpoint_results"("gradingResultId", "checkpointId");

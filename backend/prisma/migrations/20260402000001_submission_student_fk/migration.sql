-- Truncate dependent data (submissions are incompatible with new schema)
TRUNCATE TABLE "checkpoint_results" CASCADE;
TRUNCATE TABLE "grading_results" CASCADE;
TRUNCATE TABLE "submissions" CASCADE;

-- Drop old indexes/constraints
ALTER TABLE "submissions" DROP CONSTRAINT IF EXISTS "submissions_un";
DROP INDEX IF EXISTS "submissions_studentIdentifier_idx";

-- Remove old columns
ALTER TABLE "submissions" DROP COLUMN IF EXISTS "studentName";
ALTER TABLE "submissions" DROP COLUMN IF EXISTS "studentIdentifier";

-- Add studentId FK column
ALTER TABLE "submissions" ADD COLUMN "studentId" TEXT NOT NULL DEFAULT '';
ALTER TABLE "submissions" ALTER COLUMN "studentId" DROP DEFAULT;

-- Add FK constraint
ALTER TABLE "submissions" ADD CONSTRAINT "submissions_studentId_fkey"
  FOREIGN KEY ("studentId") REFERENCES "students"("id") ON DELETE CASCADE;

-- Recreate unique index and regular index
CREATE UNIQUE INDEX "submissions_un" ON "submissions"("exerciseId", "studentId");
CREATE INDEX "submissions_studentId_idx" ON "submissions"("studentId");

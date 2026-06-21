-- Truncate dependent data
TRUNCATE TABLE "checkpoint_results" CASCADE;
TRUNCATE TABLE "grading_results" CASCADE;
TRUNCATE TABLE "submissions" CASCADE;

-- Drop studentId FK and related constraints from submissions
ALTER TABLE "submissions" DROP CONSTRAINT IF EXISTS "submissions_studentId_fkey";
ALTER TABLE "submissions" DROP CONSTRAINT IF EXISTS "submissions_un";
DROP INDEX IF EXISTS "submissions_studentId_idx";
ALTER TABLE "submissions" DROP COLUMN IF EXISTS "studentId";

-- Create submission_students mapping table
CREATE TABLE "submission_students" (
    "id" TEXT NOT NULL,
    "submissionId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "submission_students_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "submission_students_submissionId_studentId_key" ON "submission_students"("submissionId", "studentId");
CREATE INDEX "submission_students_submissionId_idx" ON "submission_students"("submissionId");
CREATE INDEX "submission_students_studentId_idx" ON "submission_students"("studentId");

ALTER TABLE "submission_students" ADD CONSTRAINT "submission_students_submissionId_fkey"
    FOREIGN KEY ("submissionId") REFERENCES "submissions"("id") ON DELETE CASCADE;

ALTER TABLE "submission_students" ADD CONSTRAINT "submission_students_studentId_fkey"
    FOREIGN KEY ("studentId") REFERENCES "students"("id") ON DELETE CASCADE;

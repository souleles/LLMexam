/*
  Warnings:

  - Added the required column `studentIdentifier` to the `submissions` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "exercises" ADD COLUMN     "extractedText" TEXT;

-- AlterTable
ALTER TABLE "submissions" ADD COLUMN     "studentIdentifier" TEXT NOT NULL;

-- CreateIndex
CREATE INDEX "submissions_studentIdentifier_idx" ON "submissions"("studentIdentifier");

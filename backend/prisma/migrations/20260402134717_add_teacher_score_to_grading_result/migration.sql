-- DropForeignKey
ALTER TABLE "submission_students" DROP CONSTRAINT "submission_students_studentId_fkey";

-- DropForeignKey
ALTER TABLE "submission_students" DROP CONSTRAINT "submission_students_submissionId_fkey";

-- AddForeignKey
ALTER TABLE "submission_students" ADD CONSTRAINT "submission_students_submissionId_fkey" FOREIGN KEY ("submissionId") REFERENCES "submissions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "submission_students" ADD CONSTRAINT "submission_students_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "students"("id") ON DELETE CASCADE ON UPDATE CASCADE;

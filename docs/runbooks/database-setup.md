# Runbook: Database Setup

PostgreSQL schema creation and migration guide for ExamChecker.

## Prerequisites

- PostgreSQL >= 15 running
- `createdb` and `psql` available in PATH
- Prisma CLI (`npx prisma`) available in the `backend/` directory

---

## 1. Create the Database

```bash
createdb examchecker
# or with explicit user:
createdb -U postgres examchecker
```

---

## 2. Run Prisma Migrations (preferred)

```bash
cd backend
npx prisma migrate dev
```

To apply existing migrations without generating a new one:

```bash
npx prisma migrate deploy
```

To regenerate the Prisma client after schema changes:

```bash
npx prisma generate
```

---

## 3. Current Schema (Prisma)

The canonical schema lives at `backend/prisma/schema.prisma`. Summary:

```
users
  id            String   @id @default(uuid())
  username      String   @unique
  password      String
  role          String   @default("teacher")
  createdAt     DateTime
  updatedAt     DateTime

exercises
  id            String         @id @default(uuid())
  title         String
  pdfUrl        String
  status        ExerciseStatus  (DRAFT | APPROVED | GRADED)
  extractedText String?
  teacherid     String         FK → users
  createdAt, updatedAt

checkpoints
  id                String   @id @default(uuid())
  exerciseId        String   FK → exercises (CASCADE)
  order             Int
  description       String
  pattern           String   — regex pattern string
  caseSensitive     Boolean  @default(false)
  patternDescription String  — human-readable explanation of the pattern
  indicatorSolution String   — example of what a correct match looks like
  createdAt, updatedAt

conversations
  id          String             @id @default(uuid())
  exerciseId  String             FK → exercises (CASCADE)
  role        ConversationRole   (PROFESSOR | ASSISTANT)
  content     String
  type        ConversationType   (CHECKPOINT | PATTERN)
  createdAt   DateTime

submissions
  id          String   @id @default(uuid())
  exerciseId  String   FK → exercises (CASCADE)
  fileName    String
  fileUrl     String
  fileType    String   — e.g. ".sql", ".py"
  content     String   — combined extracted text from all files in archive
  createdAt, updatedAt

submission_students  (M:M junction)
  id           String   @id @default(uuid())
  submissionId String   FK → submissions (CASCADE)
  studentId    String   FK → students (CASCADE)
  createdAt    DateTime
  UNIQUE (submissionId, studentId)

grading_results
  id                    String   @id @default(uuid())
  submissionId          String   @unique  FK → submissions (CASCADE)
  totalCheckpoints      Int
  passedCheckpoints     Int
  score                 Float    — regex grading: (passed/total)*100
  teacherScore          Float?   — optional professor override
  llmPassedCheckpoints  Int?     — LLM grading result
  llmScore              Float?   — LLM grading: (llmPassed/total)*100
  gradedAt              DateTime

checkpoint_results
  id                  String   @id @default(uuid())
  gradingResultId     String   FK → grading_results (CASCADE)
  checkpointId        String   FK → checkpoints (CASCADE)
  matched             Boolean  — regex grading result
  matchedSnippets     String[] — JSON: [{file, line, snippet}]
  llmMatched          Boolean? — LLM grading result
  llmMatchedSnippets  String[] — JSON: [{file, line, snippet}]
  UNIQUE (gradingResultId, checkpointId)

students
  id                 String   @id @default(uuid())
  studentIdentifier  String   @unique  — e.g. student number
  firstName          String
  lastName           String
  email              String?
  miniReport         String?  — LLM-generated performance narrative
  miniReportAt       DateTime?
  teacherid          String   FK → users
  createdAt, updatedAt
```

---

## 4. Verify Schema

```bash
psql examchecker -c "\dt"
```

Expected tables:
- `users`
- `exercises`
- `checkpoints`
- `conversations`
- `submissions`
- `submission_students`
- `grading_results`
- `checkpoint_results`
- `students`

---

## 5. Reset (development only)

```bash
dropdb examchecker && createdb examchecker
cd backend && npx prisma migrate dev
```

---

## Checkpoint Pattern Structure

Each checkpoint stores a **single regex string** (not an array) in the `pattern` column:

```json
{
  "description": "Query uses a subquery in WHERE clause",
  "pattern": "WHERE\\s+.*\\(SELECT",
  "caseSensitive": false,
  "patternDescription": "Matches WHERE clause containing a SELECT subquery",
  "indicatorSolution": "WHERE col IN (SELECT col FROM table)"
}
```

The Python grading service compiles the pattern with `re.compile(pattern, re.IGNORECASE)`
(unless `caseSensitive: true`) and searches the submission content.

For `.sql` files, the content is first split into logical blocks (PROCEDURE, TRIGGER,
FUNCTION, EVENT) before matching, to prevent greedy quantifiers from spanning
unrelated procedures.

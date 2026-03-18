# Runbook: Database Setup

PostgreSQL schema creation and migration guide for ExamChecker.

## Prerequisites

- PostgreSQL >= 15 running
- `createdb` and `psql` available in PATH

---

## 1. Create the Database

```bash
createdb examchecker
# or with explicit user:
createdb -U postgres examchecker
```

---

## 2. Full Schema (manual setup)

```sql
-- Connect to the database
\c examchecker

-- Enable UUID generation
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- exercises
CREATE TABLE exercises (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title VARCHAR(255) NOT NULL,
  original_pdf_path VARCHAR(512),
  extracted_text TEXT,
  status VARCHAR(20) NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft', 'approved')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- conversation_messages
CREATE TABLE conversation_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  exercise_id UUID NOT NULL REFERENCES exercises(id) ON DELETE CASCADE,
  role VARCHAR(20) NOT NULL CHECK (role IN ('professor', 'assistant')),
  content TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- checkpoints
CREATE TABLE checkpoints (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  exercise_id UUID NOT NULL REFERENCES exercises(id) ON DELETE CASCADE,
  description VARCHAR(500) NOT NULL,
  patterns JSONB NOT NULL DEFAULT '[]',
  match_mode VARCHAR(10) NOT NULL DEFAULT 'any'
    CHECK (match_mode IN ('any', 'all')),
  check_type VARCHAR(20) NOT NULL DEFAULT 'keyword'
    CHECK (check_type IN ('keyword', 'structural')),
  case_sensitive BOOLEAN NOT NULL DEFAULT false,
  order_index INTEGER NOT NULL DEFAULT 0
);

-- submissions
CREATE TABLE submissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  exercise_id UUID NOT NULL REFERENCES exercises(id) ON DELETE CASCADE,
  student_identifier VARCHAR(255) NOT NULL,
  original_file_path VARCHAR(512),
  extracted_text TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- grading_results
CREATE TABLE grading_results (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  submission_id UUID NOT NULL REFERENCES submissions(id) ON DELETE CASCADE,
  checkpoint_id UUID NOT NULL REFERENCES checkpoints(id) ON DELETE CASCADE,
  matched BOOLEAN NOT NULL DEFAULT false,
  confidence FLOAT NOT NULL DEFAULT 0,
  matched_patterns JSONB NOT NULL DEFAULT '[]',
  matched_snippets JSONB NOT NULL DEFAULT '[]',
  UNIQUE (submission_id, checkpoint_id)
);

-- Indexes
CREATE INDEX idx_conversation_exercise ON conversation_messages(exercise_id);
CREATE INDEX idx_checkpoints_exercise ON checkpoints(exercise_id, order_index);
CREATE INDEX idx_submissions_exercise ON submissions(exercise_id);
CREATE INDEX idx_grading_submission ON grading_results(submission_id);
CREATE INDEX idx_grading_checkpoint ON grading_results(checkpoint_id);
```

---

## 3. Via ORM Migrations (preferred)

If using **TypeORM**:
```bash
cd backend
npm run typeorm migration:run
```

If using **Prisma**:
```bash
cd backend
npx prisma migrate dev
```

---

## 4. Verify Schema

```bash
psql examchecker -c "\dt"
```

Expected tables:
- `exercises`
- `conversation_messages`
- `checkpoints`
- `submissions`
- `grading_results`

---

## 5. Reset (development only)

```bash
dropdb examchecker && createdb examchecker
cd backend && npm run db:migrate
```

---

## Checkpoint JSON Structure

The `checkpoints.patterns` JSONB column stores an array of regex strings:

```json
{
  "description": "Query uses a subquery in WHERE clause",
  "patterns": ["WHERE\\s+.*\\(SELECT", "NOT\\s+IN\\s*\\(SELECT", "EXISTS\\s*\\(SELECT"],
  "match_mode": "any",
  "check_type": "keyword",
  "case_sensitive": false,
  "order_index": 0
}
```

For `check_type: "structural"`, the Python service's `sqlparse` output is used instead of
raw regex. The `patterns` array in this case holds token-path descriptors (TBD during implementation).

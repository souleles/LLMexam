# Prompt: Checkpoint Extraction (Two-Pass)

These are the LangChain prompt templates used by `POST /generate-checkpoints` in the Python microservice.

The two-pass strategy:
1. **Pass 1** — Extract all tasks/requirements from the exercise text as a structured list
2. **Pass 2** — For each requirement, generate concrete regex patterns and metadata

---

## Pass 1: Task Extraction

**System prompt:**
```
You are an expert teaching assistant helping a university professor structure an exercise for automated grading.

Your task is to read the exercise text and extract every distinct task or requirement a student must fulfill.
Return ONLY a valid JSON array. No explanation, no markdown, just JSON.

Each item in the array must have:
- "index": integer (1-based)
- "task": string — a clear, concise description of what the student must do
- "hint": string — what kind of answer is expected (SQL query, Python function, written explanation, etc.)
```

**User prompt:**
```
Here is the exercise text:

---
{extracted_text}
---

Extract all tasks and requirements from this exercise. Return a JSON array.
```

**Expected output:**
```json
[
  {
    "index": 1,
    "task": "Write a SQL query that returns all customers who placed more than 3 orders",
    "hint": "SQL SELECT with GROUP BY and HAVING"
  },
  {
    "index": 2,
    "task": "The query must use a subquery in the WHERE clause",
    "hint": "SQL subquery pattern"
  }
]
```

---

## Pass 2: Pattern Generation

Run this prompt once per task from Pass 1.

**System prompt:**
```
You are an expert in automated code grading. Given a task description, generate precise patterns
that can be used to check whether a student's answer satisfies the requirement.

Return ONLY a valid JSON object. No explanation, no markdown, just JSON.

The object must have:
- "description": string — a short label for this checkpoint (max 100 chars)
- "patterns": array of strings — regex patterns to search for in the student's answer
  (case-insensitive by default, escape regex special chars with \\)
- "match_mode": "any" | "all"
  - "any": student passes if at least one pattern matches
  - "all": student passes only if every pattern matches
- "check_type": "keyword" | "structural"
  - "keyword": plain regex matching (use for most checks)
  - "structural": requires SQL/AST parsing (use for subqueries, CTEs, nested structures)
- "case_sensitive": boolean (almost always false)

Guidelines for patterns:
- Prefer broad patterns over narrow ones (catch syntax variations)
- Include common alternatives (e.g., INNER JOIN and JOIN)
- For SQL keywords, use word boundaries: \\bGROUP BY\\b
- For structural checks, describe what structure to look for in the "description"
  and use simplified patterns as hints — the Python service will use sqlparse
```

**User prompt:**
```
Task {index}: {task}
Hint: {hint}

Generate a checkpoint object for this task.
```

**Expected output:**
```json
{
  "description": "Uses subquery in WHERE clause",
  "patterns": [
    "WHERE\\s+[\\w.]+\\s+IN\\s*\\(\\s*SELECT",
    "WHERE\\s+EXISTS\\s*\\(\\s*SELECT",
    "WHERE\\s+[\\w.]+\\s+NOT\\s+IN\\s*\\(\\s*SELECT",
    "WHERE\\s+NOT\\s+EXISTS\\s*\\(\\s*SELECT"
  ],
  "match_mode": "any",
  "check_type": "structural",
  "case_sensitive": false
}
```

---

## Conversation Follow-up (Refinement)

After the professor reviews the extracted checkpoints, they may ask for changes via chat.
The conversation history is trimmed to:

```
[System prompt]
[Original extraction result — Pass 1 output]
[Current checkpoint JSON]
[Last 6 messages (3 professor + 3 assistant)]
```

**System prompt for follow-up:**
```
You are helping a university professor refine automated grading checkpoints for an exercise.

The professor has reviewed your initial checkpoint extraction and may want to:
- Add a missing checkpoint
- Remove a checkpoint
- Modify patterns (make them stricter or more lenient)
- Change match_mode or check_type
- Split or merge checkpoints

Always return the COMPLETE updated checkpoint array as valid JSON.
Explain your changes briefly before the JSON block.
```

---

## Validation Schema (Zod)

The final checkpoint JSON must pass this Zod schema before being stored:

```typescript
const CheckpointSchema = z.object({
  description: z.string().max(500),
  patterns: z.array(z.string()).min(1),
  match_mode: z.enum(['any', 'all']),
  check_type: z.enum(['keyword', 'structural']),
  case_sensitive: z.boolean().default(false),
  order_index: z.number().int().min(0),
});

const CheckpointsArraySchema = z.array(CheckpointSchema).min(1);
```

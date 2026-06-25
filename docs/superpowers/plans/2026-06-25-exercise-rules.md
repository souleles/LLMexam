# Exercise Rules Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let a professor attach a persistent list of free-text "rules" to an `EXERCISE`-type exercise, editable below the checkpoints panel, and have those rules injected into both the checkpoint-generation and pattern-generation LLM prompts on every call.

**Architecture:** New `Rule` Prisma model (FK to `Exercise`, cascade delete) + a `RulesModule` in NestJS exposing `GET /rules?exerciseId=` and a full-replace `PUT /rules/:exerciseId`. `LlmService` fetches rules and forwards them as a new `rules: string[]` field to the Python service's `/generate-checkpoints` and `/generate-patterns` calls; the Python prompts interpolate them as a Greek sentence joined by `, `. Frontend gets a new `RulesCard` component (Chakra UI, modeled on `CheckpointsCard`) with local-staged add/edit/delete and a single Save button, rendered on `ExerciseDetailPage` below `CheckpointsCard`, hidden for PROJECT exercises.

**Tech Stack:** NestJS + Prisma + PostgreSQL (backend), React + Chakra UI + React Query (frontend), FastAPI + LangChain (python-service).

## Global Constraints

- Rules feature is scoped to `EXERCISE`-type exercises only — never shown/sent for `PROJECT` exercises (no checkpoint/pattern generation exists for projects).
- All adds/edits/deletes are staged client-side; nothing is persisted until the professor clicks "Αποθήκευση" (full-replace semantics on save).
- Rules are joined with `", "` and prefixed with the Greek sentence "Λάβε υπόψην του εξής κανόνες: " in both the checkpoint and pattern LLM prompts; the line is omitted entirely when there are no rules.
- No commits — do not run `git commit` at the end of any task in this plan; the user will review and commit manually.

---

### Task 1: Add `Rule` Prisma model and migration

**Files:**
- Modify: `backend/prisma/schema.prisma`

**Interfaces:**
- Produces: Prisma model `Rule` with fields `id: string`, `exerciseId: string`, `content: string`, `order: number`, `createdAt: Date`, relation `exercise: Exercise`. `Exercise` gains `rules: Rule[]`.

- [ ] **Step 1: Add the `Rule` model**

In `backend/prisma/schema.prisma`, add a `rules: Rule[]` field to the `Exercise` model (right after `checkpoints`) and add a new `Rule` model right after the `Checkpoint` model:

```prisma
model Exercise {
  id            String         @id @default(uuid())
  title         String
  pdfUrl        String
  status        ExerciseStatus @default(DRAFT)
  createdAt     DateTime       @default(now())
  updatedAt     DateTime       @updatedAt
  extractedText String?
  teacherid     String
  exerciseType  ExerciseType   @default(EXERCISE)
  checkpoints   Checkpoint[]
  rules         Rule[]
  conversations Conversation[]
  users         users          @relation(fields: [teacherid], references: [id], onDelete: NoAction, onUpdate: NoAction, map: "exercises_fk")
  submissions   Submission[]

  @@map("exercises")
}

model Checkpoint {
  ...unchanged...
}

model Rule {
  id         String   @id @default(uuid())
  exerciseId String
  content    String
  order      Int
  createdAt  DateTime @default(now())
  exercise   Exercise @relation(fields: [exerciseId], references: [id], onDelete: Cascade)

  @@index([exerciseId])
  @@map("rules")
}
```

- [ ] **Step 2: Generate and run the migration**

Run from `backend/`:
```bash
npx prisma migrate dev --name add_rule_model
```
Expected: prints `Your database is now in sync with your schema.` and creates a new folder under `backend/prisma/migrations/` containing `migration.sql` with a `CREATE TABLE "rules" (...)`.

- [ ] **Step 3: Verify the Prisma client picked up the new model**

Run from `backend/`:
```bash
npx prisma generate
```
Expected: completes without error, and `node_modules/.prisma/client/index.d.ts` now contains a `Rule` type (no need to manually inspect — the next task's TypeScript compile will fail loudly if it didn't).

---

### Task 2: Backend `RulesModule` (CRUD: list + full-replace)

**Files:**
- Create: `backend/src/rules/dto/rule.dto.ts`
- Create: `backend/src/rules/rules.service.ts`
- Create: `backend/src/rules/rules.controller.ts`
- Create: `backend/src/rules/rules.module.ts`
- Modify: `backend/src/app.module.ts`

**Interfaces:**
- Consumes: `PrismaService` (global, from `PrismaModule`, no explicit import needed — same pattern as `CheckpointsService`).
- Produces: `RulesService.findByExercise(exerciseId: string): Promise<RuleResponseDto[]>`, `RulesService.replace(exerciseId: string, contents: string[]): Promise<RuleResponseDto[]>`. Routes `GET /rules?exerciseId=` and `PUT /rules/:exerciseId`.

- [ ] **Step 1: Create the DTOs**

`backend/src/rules/dto/rule.dto.ts`:
```typescript
import { IsArray, IsString } from 'class-validator';

export class ReplaceRulesDto {
  @IsArray()
  @IsString({ each: true })
  rules: string[];
}

export class RuleResponseDto {
  id: string;
  exerciseId: string;
  content: string;
  order: number;
  createdAt: Date;
}
```

- [ ] **Step 2: Create the service**

`backend/src/rules/rules.service.ts`:
```typescript
import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { RuleResponseDto } from './dto/rule.dto';

@Injectable()
export class RulesService {
  constructor(private readonly prisma: PrismaService) {}

  async findByExercise(exerciseId: string): Promise<RuleResponseDto[]> {
    return this.prisma.rule.findMany({
      where: { exerciseId },
      orderBy: { order: 'asc' },
    });
  }

  async replace(exerciseId: string, contents: string[]): Promise<RuleResponseDto[]> {
    const exercise = await this.prisma.exercise.findUnique({
      where: { id: exerciseId },
    });

    if (!exercise) {
      throw new NotFoundException(`Exercise with ID ${exerciseId} not found`);
    }

    const trimmed = contents.map((c) => c.trim()).filter((c) => c.length > 0);

    await this.prisma.$transaction([
      this.prisma.rule.deleteMany({ where: { exerciseId } }),
      ...trimmed.map((content, index) =>
        this.prisma.rule.create({
          data: { exerciseId, content, order: index + 1 },
        }),
      ),
    ]);

    return this.findByExercise(exerciseId);
  }
}
```

- [ ] **Step 3: Create the controller**

`backend/src/rules/rules.controller.ts`:
```typescript
import { Controller, Get, Put, Body, Param, Query, UseGuards } from '@nestjs/common';
import { RulesService } from './rules.service';
import { ReplaceRulesDto, RuleResponseDto } from './dto/rule.dto';
import { AuthGuard } from '../auth/guards/auth.guard';

@Controller('rules')
@UseGuards(AuthGuard)
export class RulesController {
  constructor(private readonly rulesService: RulesService) {}

  @Get()
  findAll(@Query('exerciseId') exerciseId: string): Promise<RuleResponseDto[]> {
    return this.rulesService.findByExercise(exerciseId);
  }

  @Put(':exerciseId')
  replace(
    @Param('exerciseId') exerciseId: string,
    @Body() body: ReplaceRulesDto,
  ): Promise<RuleResponseDto[]> {
    return this.rulesService.replace(exerciseId, body.rules);
  }
}
```

- [ ] **Step 4: Create the module**

`backend/src/rules/rules.module.ts`:
```typescript
import { Module } from '@nestjs/common';
import { RulesService } from './rules.service';
import { RulesController } from './rules.controller';

@Module({
  controllers: [RulesController],
  providers: [RulesService],
  exports: [RulesService],
})
export class RulesModule {}
```

- [ ] **Step 5: Register `RulesModule` in `AppModule`**

In `backend/src/app.module.ts`, add the import and add `RulesModule` to the `imports` array (alongside `CheckpointsModule`):

```typescript
import { RulesModule } from './rules/rules.module';
```
```typescript
  imports: [
    ...
    CheckpointsModule,
    RulesModule,
    SubmissionsModule,
    ...
  ],
```

- [ ] **Step 6: Compile-check the backend**

Run from `backend/`:
```bash
npm run build
```
Expected: `webpack compiled successfully` (or equivalent Nest CLI success output), no TypeScript errors.

---

### Task 3: Forward rules to the Python service from `LlmService`

**Files:**
- Modify: `backend/src/llm/llm.service.ts`

**Interfaces:**
- Consumes: `this.prisma.rule` (Prisma model from Task 1).
- Produces: both `/generate-checkpoints` and `/generate-patterns` axios payloads now include `rules: string[]` (array of rule `content` strings, ordered).

- [ ] **Step 1: Fetch and forward rules in `streamResponse`**

In `backend/src/llm/llm.service.ts`, inside `streamResponse` (around line 59, right after `currentCheckpoints` is fetched), add:

```typescript
    const currentCheckpoints = await this.prisma.checkpoint.findMany({
      where: { exerciseId },
      orderBy: { order: 'asc' },
    });

    const rules = await this.prisma.rule.findMany({
      where: { exerciseId },
      orderBy: { order: 'asc' },
    });
```

Then in the axios payload right below, add the `rules` field:

```typescript
      const response = await axios.post(
        `${this.pythonServiceUrl}/generate-checkpoints`,
        {
          text: exercise.extractedText ?? '',
          current_checkpoints: JSON.stringify(currentCheckpoints),
          message,
          rules: rules.map((r) => r.content),
          history: history.slice(0, -1).map((msg) => ({
            role: msg.role.toLowerCase(),
            content: msg.content,
          })),
        },
```

- [ ] **Step 2: Fetch and forward rules in `streamPatternResponse`**

In the same file, inside `streamPatternResponse` (around line 123, right after `checkpoints` is fetched), add:

```typescript
    const checkpoints = await this.prisma.checkpoint.findMany({
      where: { exerciseId },
      orderBy: { order: 'asc' },
    });

    const rules = await this.prisma.rule.findMany({
      where: { exerciseId },
      orderBy: { order: 'asc' },
    });
```

Then add `rules` to the `/generate-patterns` payload:

```typescript
      const response = await axios.post(
        `${this.pythonServiceUrl}/generate-patterns`,
        {
          checkpoints: checkpoints.map((cp) => ({
            order: cp.order,
            description: cp.description,
            current_pattern: pendingPatterns?.get(cp.order) ?? cp.pattern,
          })),
          message,
          rules: rules.map((r) => r.content),
          history: history.slice(0, -1).map((msg) => ({
            role: msg.role.toLowerCase(),
            content: msg.content,
          })),
        },
```

- [ ] **Step 3: Compile-check the backend**

Run from `backend/`:
```bash
npm run build
```
Expected: builds successfully with no TypeScript errors.

---

### Task 4: Python service — accept `rules` and inject into prompts

**Files:**
- Modify: `python-service/models.py`
- Modify: `python-service/prompts/checkpoint_prompts.py`
- Modify: `python-service/prompts/patterns_prompts.py`
- Modify: `python-service/services/llm_service.py`
- Test: `python-service/tests/test_llm.py`

**Interfaces:**
- Consumes: `GenerateCheckpointsRequest.rules: list[str]`, `GeneratePatternsRequest.rules: list[str]` (new fields, both default `[]`).
- Produces: a module-level helper `build_rules_text(rules: list[str]) -> str` in `services/llm_service.py`, used by both `build_messages` and `_build_pattern_messages`.

- [ ] **Step 1: Add `rules` field to the Pydantic request models**

In `python-service/models.py`, add `rules` to both `GenerateCheckpointsRequest` and `GeneratePatternsRequest`:

```python
class GenerateCheckpointsRequest(BaseModel):
    """Request body for /generate-checkpoints endpoint."""
    text: str = Field(..., description="Original exercise extracted text")
    current_checkpoints: str = Field(default="", description="Current checkpoint JSON as string")
    history: list[Message] = Field(default_factory=list, description="Conversation history")
    message: str = Field(..., description="Current professor message")
    rules: list[str] = Field(default_factory=list, description="Teacher-supplied standing rules")
```

```python
class GeneratePatternsRequest(BaseModel):
    """Request body for /generate-patterns endpoint."""
    checkpoints: list[CheckpointInfo] = Field(..., description="List of checkpoints to generate patterns for")
    extracted_text: str = Field(default="", description="Original exercise text for context")
    history: list[Message] = Field(default_factory=list, description="Pattern conversation history")
    message: str = Field(..., description="Current professor message")
    rules: list[str] = Field(default_factory=list, description="Teacher-supplied standing rules")
```

- [ ] **Step 2: Write the failing test for the rules-text helper**

In `python-service/tests/test_llm.py`, add at the bottom:

```python
def test_build_rules_text_empty():
    from services.llm_service import build_rules_text

    assert build_rules_text([]) == ""


def test_build_rules_text_with_rules():
    from services.llm_service import build_rules_text

    result = build_rules_text(["Όλα τα ονόματα στα Αγγλικά", "Χρήση snake_case"])

    assert result == "Λάβε υπόψην του εξής κανόνες: Όλα τα ονόματα στα Αγγλικά, Χρήση snake_case\n\n"
```

- [ ] **Step 3: Run the test to verify it fails**

Run from `python-service/` (with venv activated):
```bash
python -m pytest tests/test_llm.py -v -k build_rules_text
```
Expected: FAIL with `ImportError: cannot import name 'build_rules_text'`.

- [ ] **Step 4: Implement `build_rules_text` in `llm_service.py`**

In `python-service/services/llm_service.py`, add this function near the top, right after the `logger = logging.getLogger(__name__)` line:

```python
def build_rules_text(rules: list[str]) -> str:
    """Build the teacher-rules sentence injected into prompts, or '' if no rules."""
    if not rules:
        return ""
    return f"Λάβε υπόψην του εξής κανόνες: {', '.join(rules)}\n\n"
```

- [ ] **Step 5: Run the test to verify it passes**

Run from `python-service/`:
```bash
python -m pytest tests/test_llm.py -v -k build_rules_text
```
Expected: 2 passed.

- [ ] **Step 6: Add `{rules_text}` placeholder to the checkpoint prompts**

In `python-service/prompts/checkpoint_prompts.py`, update `USER_PROMPT_INITIAL` (currently lines 239–257) to insert the placeholder right before the "Οδηγίες καθηγητή" line:

```python
USER_PROMPT_INITIAL = """Ακολουθεί το κείμενο της άσκησης:

---
{extracted_text}
---

{rules_text}Οδηγίες καθηγητή: {message}

**Εργασία σου:**
1. Διάβασε προσεκτικά το κείμενο της άσκησης
2. Εξήγαγε ΟΛΕΣ τις ξεχωριστές απαιτήσεις ως ξεχωριστά checkpoints
3. Γράψε σαφείς, συνοπτικές περιγραφές στα Ελληνικά
4. Άφησε το πεδίο "pattern" κενό (θα συμπληρωθεί αργότερα)
5. Άφησε το πεδίο "patternDescription" κενό (θα συμπληρωθεί αργότερα)
6. Προτίμησε πολλά granular checkpoints παρά λίγα σύνθετα
7. ΜΗΝ γράψεις regex patterns - μόνο περιγραφές
8. ΜΗΝ γράψεις patternDescription - αυτό θα γίνει αργότερα

Επέστρεψε το JSON array των checkpoints:"""
```

And update `USER_PROMPT_REFINEMENT` (currently lines 287–289) the same way:

```python
USER_PROMPT_REFINEMENT = """{rules_text}Σχόλια καθηγητή: {message}

Επέστρεψε το ενημερωμένο checkpoint array:"""
```

- [ ] **Step 7: Add `{rules_text}` placeholder to the pattern prompt**

In `python-service/prompts/patterns_prompts.py`, update `USER_PROMPT_PATTERNS` (currently lines 345–368) to insert the placeholder right before "Οδηγίες καθηγητή":

```python
USER_PROMPT_PATTERNS = """Ακολουθούν τα τρέχοντα checkpoints:

```json
{checkpoints}
```

Άσκηση:
```
{extracted_text}
```

{rules_text}Οδηγίες καθηγητή: {message}

**Εργασία σου:**
1. Ανάλυσε κάθε checkpoint pattern
2. Βελτίωσε patterns που είναι υπερβολικά αυστηρά ή generic
3. Πρόσθεσε εναλλακτικές λύσεις όπου χρειάζεται
4. Χρησιμοποίησε `(?i)` για case-insensitivity
5. Χρησιμοποίησε `[\\s\\S]*?` για multi-line matching
6. Προτίμησε πολλά granular checkpoints παρά λίγα πολύπλοκα
7. Για Ελληνικά ονόματα πινάκων/μεταβλητών/πεδίων: πρόσθεσε πάντα και τη Greeklish παραλλαγή (π.χ. `(?:έδρα|edra)`, `(?:φοιτητής|foititis)`)
8. Για κάθε pattern γράψε `patternDescription`: εξήγησε τι κείμενο ψάχνει το regex στον κώδικα (ποιες λέξεις, σύνταξη, flags) — ΟΧΙ τι ελέγχει το checkpoint

Επέστρεψε το ενημερωμένο JSON array:"""
```

(Note: this block above is illustrative of the change location — when editing, only insert `{rules_text}` before `Οδηγίες καθηγητή: {message}`; do not otherwise alter the surrounding text or escaping.)

- [ ] **Step 8: Pass `rules_text` into all three `.format()` calls in `llm_service.py`**

In `python-service/services/llm_service.py`, update `build_messages` (the `is_initial` branch and the `else` branch):

```python
    if is_initial:
        # Initial extraction — include user message so professor can guide extraction
        messages.append(SystemMessage(content=SYSTEM_PROMPT_INITIAL))
        user_content = USER_PROMPT_INITIAL.format(
            extracted_text=request.text,
            message=request.message,
            rules_text=build_rules_text(request.rules),
        )
        messages.append(HumanMessage(content=user_content))
    else:
        # Refinement conversation
        system_content = SYSTEM_PROMPT_REFINEMENT.format(
            current_checkpoints=request.current_checkpoints or "[]",
            extracted_text=request.text,
        )
        messages.append(SystemMessage(content=system_content))

        # Add last 6 messages from history (3 professor + 3 assistant)
        history_to_include = request.history[-6:] if len(request.history) > 6 else request.history
        for msg in history_to_include:
            if msg.role == "professor":
                messages.append(HumanMessage(content=msg.content))
            else:
                messages.append(AIMessage(content=msg.content))

        # Add current message
        user_content = USER_PROMPT_REFINEMENT.format(
            extracted_text=request.text,
            message=request.message,
            rules_text=build_rules_text(request.rules),
        )
        messages.append(HumanMessage(content=user_content))
```

And update `_build_pattern_messages`:

```python
    user_content = USER_PROMPT_PATTERNS.format(
        checkpoints=checkpoints_json,
        extracted_text=request.extracted_text,
        message=request.message,
        rules_text=build_rules_text(request.rules),
    )
    messages.append(HumanMessage(content=user_content))
```

- [ ] **Step 9: Run the full python-service test suite**

Run from `python-service/`:
```bash
python -m pytest tests/test_llm.py -v
```
Expected: all tests pass (5 total: the 3 pre-existing `test_build_messages_*` tests plus the 2 new `test_build_rules_text_*` tests).

---

### Task 5: Frontend API client, query key, and hooks for rules

**Files:**
- Modify: `frontend/src/lib/api.ts`
- Modify: `frontend/src/lib/queryKeys.ts`
- Create: `frontend/src/hooks/use-get-rules.ts`
- Create: `frontend/src/hooks/use-replace-rules.ts`

**Interfaces:**
- Produces: `interface Rule { id: string; exerciseId: string; content: string; order: number; }`, `api.rules.list(exerciseId: string): Promise<Rule[]>`, `api.rules.replace(exerciseId: string, rules: string[]): Promise<Rule[]>`, `useGetRules(exerciseId)`, `useReplaceRules(options?)`.

- [ ] **Step 1: Add `Rule` interface and `api.rules` methods**

In `frontend/src/lib/api.ts`, add the interface right after `Checkpoint` (after line 33):

```typescript
export interface Rule {
  id: string;
  exerciseId: string;
  content: string;
  order: number;
}
```

Then add a `rules` section to the `api` object, right after the `checkpoints` section (after the closing `},` of `checkpoints` around line 193):

```typescript
  rules: {
    list: async (exerciseId: string): Promise<Rule[]> => {
      const { data } = await httpClient.get(`/api/rules?exerciseId=${exerciseId}`);
      return data;
    },
    replace: async (exerciseId: string, rules: string[]): Promise<Rule[]> => {
      const { data } = await httpClient.put(`/api/rules/${exerciseId}`, { rules });
      return data;
    },
  },
```

- [ ] **Step 2: Add `Rules` query key**

In `frontend/src/lib/queryKeys.ts`, add `Rules = 'rules',` to the enum, after `Checkpoints`:

```typescript
export enum QueryKeys {
  Exercises = 'exercises',
  Exercise = 'exercise',
  Checkpoints = 'checkpoints',
  Rules = 'rules',
  Submissions = 'submissions',
  GradingResults = 'grading-results',
  Students = 'students',
  Conversations = 'conversations',
  Profile = 'profile',
}
```

- [ ] **Step 3: Create `useGetRules`**

`frontend/src/hooks/use-get-rules.ts`:
```typescript
import { api } from '@/lib/api';
import { QueryKeys } from '@/lib/queryKeys';
import { useQuery } from '@tanstack/react-query';

export function useGetRules(exerciseId: string | undefined) {
  return useQuery({
    queryKey: [QueryKeys.Rules, exerciseId],
    queryFn: () => api.rules.list(exerciseId!),
    enabled: !!exerciseId,
  });
}
```

- [ ] **Step 4: Create `useReplaceRules`**

`frontend/src/hooks/use-replace-rules.ts`:
```typescript
import { api, Rule } from '@/lib/api';
import { UseMutationOptions, useMutation } from '@tanstack/react-query';

export function useReplaceRules(
  options?: Omit<UseMutationOptions<Rule[], Error, { exerciseId: string; rules: string[] }>, 'mutationFn'>,
) {
  return useMutation({
    mutationFn: ({ exerciseId, rules }) => api.rules.replace(exerciseId, rules),
    ...options,
  });
}
```

- [ ] **Step 5: Type-check the frontend**

Run from `frontend/`:
```bash
npx tsc --noEmit
```
Expected: no errors.

---

### Task 6: `RulesCard` component

**Files:**
- Create: `frontend/src/components/Exercise/RulesCard.tsx`

**Interfaces:**
- Consumes: `useGetRules(exerciseId)` and `useReplaceRules()` from Task 5.
- Produces: `RulesCard({ exerciseId }: { exerciseId: string })` React component.

- [ ] **Step 1: Write the component**

`frontend/src/components/Exercise/RulesCard.tsx`:
```typescript
import { useGetRules } from '@/hooks/use-get-rules';
import { useReplaceRules } from '@/hooks/use-replace-rules';
import { QueryKeys } from '@/lib/queryKeys';
import {
  Box,
  Button,
  Card,
  CardBody,
  Divider,
  Heading,
  HStack,
  IconButton,
  Input,
  List,
  ListItem,
  Text,
  VStack,
} from '@chakra-ui/react';
import { useQueryClient } from '@tanstack/react-query';
import { useEffect, useRef, useState } from 'react';
import { FiList, FiPlus, FiX } from 'react-icons/fi';

interface RulesCardProps {
  exerciseId: string;
}

export function RulesCard({ exerciseId }: RulesCardProps) {
  const queryClient = useQueryClient();
  const { data: savedRules = [] } = useGetRules(exerciseId);
  const replaceMutation = useReplaceRules({
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [QueryKeys.Rules, exerciseId] });
    },
  });

  const [rules, setRules] = useState<string[]>([]);
  const [newRuleText, setNewRuleText] = useState('');
  const seeded = useRef(false);

  useEffect(() => {
    if (!seeded.current && savedRules.length > 0) {
      setRules(savedRules.map((r) => r.content));
      seeded.current = true;
    }
  }, [savedRules]);

  const savedContents = savedRules.map((r) => r.content);
  const isDirty = JSON.stringify(rules) !== JSON.stringify(savedContents);

  const handleAdd = () => {
    const trimmed = newRuleText.trim();
    if (!trimmed) return;
    setRules((prev) => [...prev, trimmed]);
    setNewRuleText('');
  };

  const handleDelete = (index: number) => {
    setRules((prev) => prev.filter((_, i) => i !== index));
  };

  const handleChange = (index: number, value: string) => {
    setRules((prev) => prev.map((r, i) => (i === index ? value : r)));
  };

  const handleSave = () => {
    replaceMutation.mutate({ exerciseId, rules });
  };

  return (
    <Card h="full">
      <CardBody>
        <VStack align="start" spacing={4}>
          <HStack>
            <FiList size={24} />
            <Heading size="md">Προσθήκη κανόνων</Heading>
          </HStack>
          <Text fontSize="sm" color="gray.400">
            Αυτοί οι κανόνες θα χρησιμοποιηθούν για την δημιουργία checkpoint και regex.
          </Text>
          <Divider />
          <List spacing={2} w="full">
            {rules.map((rule, index) => (
              <ListItem key={index}>
                <HStack>
                  <Input
                    value={rule}
                    onChange={(e) => handleChange(index, e.target.value)}
                  />
                  <IconButton
                    aria-label="Διαγραφή κανόνα"
                    icon={<FiX />}
                    size="sm"
                    variant="ghost"
                    onClick={() => handleDelete(index)}
                  />
                </HStack>
              </ListItem>
            ))}
          </List>
          <HStack w="full">
            <Input
              placeholder="Νέος κανόνας..."
              value={newRuleText}
              onChange={(e) => setNewRuleText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  handleAdd();
                }
              }}
            />
            <IconButton
              aria-label="Προσθήκη κανόνα"
              icon={<FiPlus />}
              colorScheme="brand"
              onClick={handleAdd}
            />
          </HStack>
          <Box w="full" textAlign="right">
            <Button
              colorScheme="brand"
              isDisabled={!isDirty}
              isLoading={replaceMutation.isPending}
              onClick={handleSave}
            >
              Αποθήκευση
            </Button>
          </Box>
        </VStack>
      </CardBody>
    </Card>
  );
}
```

- [ ] **Step 2: Type-check the frontend**

Run from `frontend/`:
```bash
npx tsc --noEmit
```
Expected: no errors.

---

### Task 7: Wire `RulesCard` into `ExerciseDetailPage`

**Files:**
- Modify: `frontend/src/pages/ExerciseDetailPage.tsx`

- [ ] **Step 1: Import and render `RulesCard`**

In `frontend/src/pages/ExerciseDetailPage.tsx`, add the import next to the `CheckpointsCard` import (line 4):

```typescript
import { CheckpointsCard } from '@/components/Exercise/CheckpointsCard';
import { RulesCard } from '@/components/Exercise/RulesCard';
```

Then render it directly below the existing `CheckpointsCard` line (line 190):

```tsx
          {/* Checkpoints card — hidden for project exercises */}
          {!isProject && <CheckpointsCard checkpoints={checkpoints} />}

          {/* Rules card — hidden for project exercises */}
          {!isProject && <RulesCard exerciseId={exercise.id} />}
```

- [ ] **Step 2: Type-check the frontend**

Run from `frontend/`:
```bash
npx tsc --noEmit
```
Expected: no errors.

- [ ] **Step 3: Manual smoke test**

With backend, python-service, and frontend dev servers running (`npm run dev` in each, per `docs/runbooks/local-dev.md`), open an `EXERCISE`-type exercise's detail page in the browser and verify:
- The "Προσθήκη κανόνων" card renders below the checkpoints card, with the helper text "Αυτοί οι κανόνες θα χρησιμοποιηθούν για την δημιουργία checkpoint και regex." underneath the heading.
- Typing text and clicking "+" adds a new input row; "Αποθήκευση" is disabled until a change is made.
- Clicking "Αποθήκευση" persists the rules; reloading the page shows the same rules.
- Deleting a rule and saving removes it after reload.
- Open a `PROJECT`-type exercise's detail page and verify the rules card does NOT render.
- In the checkpoints/patterns chat tabs, send a message and confirm (via backend/python-service logs or a debugger breakpoint) that the `rules` array reaches `llm_service.py` and the formatted prompt sent to OpenAI contains the "Λάβε υπόψην του εξής κανόνες: ..." line when rules exist.

---

## Self-Review Notes

- **Spec coverage:** Data model (Task 1), backend API (Task 2), `LlmService` forwarding (Task 3), Python models + prompts (Task 4), frontend API/hooks (Task 5), `RulesCard` UI (Task 6), page wiring (Task 7) — all spec sections covered.
- **No placeholders:** every step has full code, no "TBD"/"similar to above".
- **Type consistency:** `Rule.content` (Prisma) → `RuleResponseDto.content` → `api.ts Rule.content` → `RulesCard` state — consistent end-to-end. `rules: string[]` consistent across `LlmService` payload, Pydantic models, and prompt `.format()` calls.

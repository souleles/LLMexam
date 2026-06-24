# Per-Checkpoint Teacher Accept/Reject Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let the professor accept/reject each checkpoint individually inline in the grading accordion; `teacherScore` becomes a derived count of accepted checkpoints instead of a manually-typed number, and the old "Επεξεργασία/Προσθήκη Βαθμού" modal/button is removed.

**Architecture:** Add a nullable `teacherAccepted` boolean to `CheckpointResult`. A new PATCH endpoint flips one checkpoint's `teacherAccepted` and recomputes+persists `GradingResult.teacherScore` as the count of accepted checkpoints. The frontend accordion gets inline accept/reject controls wired to this endpoint; the manual-score modal is deleted.

**Tech Stack:** NestJS + Prisma (backend), React + Chakra UI + React Query (frontend).

## Global Constraints

- No backend unit tests exist in this repo today (`backend/src/**/*.spec.ts` — none found, despite `jest` being configured). Do not introduce a new testing convention unilaterally; verify each backend task with `npm run build` (tsc) inside `backend/` plus a manual `curl`/Prisma Studio check where noted.
- Frontend has no test files either. Verify frontend tasks with `npx tsc --noEmit` inside `frontend/` plus the manual browser check in the final task.
- Match existing NestJS/Prisma/Chakra conventions exactly — see `backend/CLAUDE.md` and `frontend/CLAUDE.md`.
- Conventional commits (`feat:`, `fix:`, `chore:`), one logical change per commit, no co-author lines (per root `CLAUDE.md`).

---

## File Structure

| File | Change |
|---|---|
| `backend/prisma/schema.prisma` | Add `teacherAccepted Boolean?` to `CheckpointResult` |
| `backend/src/grading/dto/grading.dto.ts` | Add `teacherAccepted` to `CheckpointResultDto`; remove `UpdateTeacherScoreDto` |
| `backend/src/grading/grading.service.ts` | Remove `updateTeacherScore`; add `updateCheckpointTeacherAccepted`; include `teacherAccepted` in mapped results |
| `backend/src/grading/grading.controller.ts` | Replace teacher-score route with teacher-accepted route |
| `backend/src/submissions/submissions.service.ts` | `findOne()` maps `teacherAccepted` into `checkpointResults` |
| `frontend/src/lib/api.ts` | Update `Submission` type; replace `grading.updateTeacherScore` with `grading.updateCheckpointTeacherAccepted` |
| `frontend/src/hooks/use-save-teacher-score.ts` | Delete |
| `frontend/src/hooks/use-update-checkpoint-teacher-accepted.ts` | Create |
| `frontend/src/lib/helpers.ts` | `mapCheckpointResultsToAccordionItems` passes through `checkpointResultId` + `teacherAccepted` |
| `frontend/src/components/GradingAccordion/index.tsx` | Add accept/reject controls per item |
| `frontend/src/components/SubmissionDetail/index.tsx` | Remove modal/button, wire new mutation |

---

### Task 1: Prisma schema + migration

**Files:**
- Modify: `backend/prisma/schema.prisma:109-126` (`CheckpointResult` model)

**Interfaces:**
- Produces: `CheckpointResult.teacherAccepted: boolean | null` (Prisma client field), consumed by Task 3 and Task 5.

- [ ] **Step 1: Add the field**

In `backend/prisma/schema.prisma`, inside `model CheckpointResult`, add the new field next to `regexFailureExplanation`:

```prisma
model CheckpointResult {
  id                      String        @id @default(uuid())
  gradingResultId         String
  checkpointId            String
  matched                 Boolean
  matchedSnippets         String[]
  createdAt               DateTime      @default(now())
  llmMatched              Boolean?
  llmMatchedSnippets      String[]      @default([])
  regexFailureExplanation String?
  teacherAccepted         Boolean?
  checkpoint              Checkpoint    @relation(fields: [checkpointId], references: [id], onDelete: Cascade)
  gradingResult           GradingResult @relation(fields: [gradingResultId], references: [id], onDelete: Cascade)

  @@unique([gradingResultId, checkpointId])
  @@index([gradingResultId])
  @@index([checkpointId])
  @@map("checkpoint_results")
}
```

- [ ] **Step 2: Generate and apply the migration**

Run from `backend/`:
```bash
npx prisma migrate dev --name add_teacher_accepted_to_checkpoint_result
```
Expected: a new folder under `backend/prisma/migrations/` containing `ALTER TABLE "checkpoint_results" ADD COLUMN "teacherAccepted" BOOLEAN;`, and the command exits 0 with "Your database is now in sync with your schema."

- [ ] **Step 3: Verify the Prisma client regenerated**

Run: `grep -r "teacherAccepted" backend/node_modules/.prisma/client/index.d.ts`
Expected: at least one match (confirms `npx prisma migrate dev` regenerated the client).

- [ ] **Step 4: Commit**

```bash
git add backend/prisma/schema.prisma backend/prisma/migrations
git commit -m "feat: add teacherAccepted column to checkpoint_results"
```

---

### Task 2: Backend DTOs

**Files:**
- Modify: `backend/src/grading/dto/grading.dto.ts`

**Interfaces:**
- Consumes: nothing new.
- Produces: `CheckpointResultDto.teacherAccepted?: boolean | null`, consumed by Task 3 (service mapping) and implicitly by the frontend's `Submission` type shape (Task 6 mirrors this).
- Produces: `UpdateTeacherAcceptedDto { teacherAccepted: boolean }`, consumed by Task 3 (service signature) and Task 4 (controller body type).

- [ ] **Step 1: Replace `UpdateTeacherScoreDto` and extend `CheckpointResultDto`**

In `backend/src/grading/dto/grading.dto.ts`, replace the top of the file:

```typescript
import { IsBoolean } from 'class-validator';

export class UpdateTeacherAcceptedDto {
  @IsBoolean()
  teacherAccepted: boolean;
}

export class GradingResultResponseDto {
  id: string;
  submissionId: string;
  totalCheckpoints: number;
  passedCheckpoints: number;
  score: number;
  teacherScore?: number;
  gradedAt: Date;
  checkpointResults: CheckpointResultDto[];
}

export class CheckpointResultDto {
  id: string;
  submissionId: string;
  checkpointId: string;
  matched: boolean;
  confidence: number;
  matchedPatterns: string[];
  matchedSnippets: Array<{
    file?: string;
    line: number;
    snippet: string;
  }>;
  teacherAccepted?: boolean | null;
  checkpoint?: {
    order: number;
    description: string;
    pattern: string;
    caseSensitive: boolean;
  };
}
```

Leave `ExerciseGradingResultsDto` and `StudentGradingResultDto` (further down the file) unchanged.

- [ ] **Step 2: Verify it compiles**

Run from `backend/`: `npx tsc --noEmit -p tsconfig.json`
Expected: errors referencing `UpdateTeacherScoreDto` in `grading.service.ts` and `grading.controller.ts` (not yet updated — that's Tasks 3-4). No errors should originate from `grading.dto.ts` itself.

- [ ] **Step 3: Commit**

```bash
git add backend/src/grading/dto/grading.dto.ts
git commit -m "feat: replace UpdateTeacherScoreDto with UpdateTeacherAcceptedDto"
```

---

### Task 3: `GradingService.updateCheckpointTeacherAccepted`

**Files:**
- Modify: `backend/src/grading/grading.service.ts`

**Interfaces:**
- Consumes: `UpdateTeacherAcceptedDto` (Task 2), Prisma `CheckpointResult.teacherAccepted` (Task 1).
- Produces: `GradingService.updateCheckpointTeacherAccepted(checkpointResultId: string, dto: UpdateTeacherAcceptedDto): Promise<GradingResultResponseDto>`, consumed by Task 4 (controller).

- [ ] **Step 1: Update the import line**

In `backend/src/grading/grading.service.ts:3-7`, replace:

```typescript
import {
  GradingResultResponseDto,
  CheckpointResultDto,
  UpdateTeacherScoreDto,
} from './dto/grading.dto';
```

with:

```typescript
import {
  GradingResultResponseDto,
  CheckpointResultDto,
  UpdateTeacherAcceptedDto,
} from './dto/grading.dto';
```

- [ ] **Step 2: Replace `updateTeacherScore` with `updateCheckpointTeacherAccepted`**

Replace the `updateTeacherScore` method (lines 96-127) with:

```typescript
  async updateCheckpointTeacherAccepted(
    checkpointResultId: string,
    dto: UpdateTeacherAcceptedDto,
  ): Promise<GradingResultResponseDto> {
    const checkpointResult = await this.prisma.checkpointResult.findUnique({
      where: { id: checkpointResultId },
    });

    if (!checkpointResult) {
      throw new NotFoundException(`Checkpoint result ${checkpointResultId} not found`);
    }

    await this.prisma.checkpointResult.update({
      where: { id: checkpointResultId },
      data: { teacherAccepted: dto.teacherAccepted },
    });

    const siblingResults = await this.prisma.checkpointResult.findMany({
      where: { gradingResultId: checkpointResult.gradingResultId },
    });
    const teacherScore = siblingResults.filter((cr) => cr.teacherAccepted === true).length;

    const updated = await this.prisma.gradingResult.update({
      where: { id: checkpointResult.gradingResultId },
      data: { teacherScore },
      include: {
        checkpointResults: {
          include: {
            checkpoint: true,
          },
        },
      },
    });

    return this.mapToResponseDto(updated);
  }
```

- [ ] **Step 3: Include `teacherAccepted` in both result mappers**

In `getAllResults` (around line 58-72), add `teacherAccepted: cr.teacherAccepted,` to the returned object:

```typescript
      return {
        id: cr.id,
        submissionId: cr.gradingResult.submissionId,
        checkpointId: cr.checkpointId,
        matched: cr.matched,
        confidence: cr.matched ? 1.0 : 0.0,
        matchedPatterns: cr.matched ? [cr.checkpoint.pattern] : [],
        matchedSnippets,
        teacherAccepted: cr.teacherAccepted,
        checkpoint: {
          order: cr.checkpoint.order,
          description: cr.checkpoint.description,
          pattern: cr.checkpoint.pattern,
          caseSensitive: cr.checkpoint.caseSensitive,
        },
      };
```

In `mapToResponseDto` (around line 137-151), add `teacherAccepted: cr.teacherAccepted,`:

```typescript
      checkpointResults: gradingResult.checkpointResults.map((cr: any) => ({
        id: cr.id,
        submissionId: gradingResult.submissionId,
        checkpointId: cr.checkpointId,
        matched: cr.matched,
        confidence: cr.matched ? 1.0 : 0.0,
        matchedPatterns: cr.matched ? [cr.checkpoint.pattern] : [],
        matchedSnippets: (cr.matchedSnippets as string[]).map((raw) => parseSnippet(raw)),
        teacherAccepted: cr.teacherAccepted,
        checkpoint: {
          order: cr.checkpoint.order,
          description: cr.checkpoint.description,
          pattern: cr.checkpoint.pattern,
          caseSensitive: cr.checkpoint.caseSensitive,
        },
      })),
```

- [ ] **Step 4: Verify it compiles**

Run from `backend/`: `npx tsc --noEmit -p tsconfig.json`
Expected: remaining errors only in `grading.controller.ts` (Task 4 not yet done). No errors in `grading.service.ts`.

- [ ] **Step 5: Commit**

```bash
git add backend/src/grading/grading.service.ts
git commit -m "feat: derive teacherScore from per-checkpoint teacherAccepted"
```

---

### Task 4: `GradingController` route

**Files:**
- Modify: `backend/src/grading/grading.controller.ts`

**Interfaces:**
- Consumes: `GradingService.updateCheckpointTeacherAccepted` (Task 3), `UpdateTeacherAcceptedDto` (Task 2).
- Produces: `PATCH /api/grading/checkpoint-result/:id/teacher-accepted`, consumed by Task 6 (frontend `api.ts`).

- [ ] **Step 1: Replace the route**

In `backend/src/grading/grading.controller.ts`, replace the import line and the `updateTeacherScore` route:

```typescript
import { Controller, Post, Get, Param, Query, Body, Patch, UseGuards } from '@nestjs/common';
import { GradingService } from './grading.service';
import { GradingResultResponseDto, CheckpointResultDto, UpdateTeacherAcceptedDto } from './dto/grading.dto';
import { AuthGuard } from '../auth/guards/auth.guard';

@Controller('grading')
@UseGuards(AuthGuard)
export class GradingController {
  constructor(private readonly gradingService: GradingService) {}

  @Get('results')
  async getResults(@Query('exerciseId') exerciseId: string): Promise<CheckpointResultDto[]> {
    return this.gradingService.getAllResults(exerciseId);
  }
  @Post('results')
  async saveResults(@Body() results: CheckpointResultDto[]): Promise<{ message: string }> {
    await this.gradingService.saveResults(results);
    return { message: 'Results saved successfully' };
  }

  @Patch('checkpoint-result/:id/teacher-accepted')
  async updateCheckpointTeacherAccepted(
    @Param('id') id: string,
    @Body() dto: UpdateTeacherAcceptedDto,
  ): Promise<GradingResultResponseDto> {
    return this.gradingService.updateCheckpointTeacherAccepted(id, dto);
  }
}
```

- [ ] **Step 2: Verify it compiles**

Run from `backend/`: `npx tsc --noEmit -p tsconfig.json`
Expected: exits 0, no errors.

- [ ] **Step 3: Manual smoke test**

Start the backend (`npm run start:dev` from `backend/`), then with a valid auth cookie/token and an existing `checkpointResultId` (look one up via Prisma Studio: `npx prisma studio` from `backend/`, open `checkpoint_results` table, copy an `id`):

```bash
curl -X PATCH http://localhost:3001/api/grading/checkpoint-result/<id>/teacher-accepted \
  -H "Content-Type: application/json" \
  --cookie "<your auth cookie>" \
  -d '{"teacherAccepted": true}'
```
Expected: 200 response with a JSON body whose `teacherScore` is `1` (or more, if other checkpoints in that grading result were already accepted) and whose `checkpointResults` array contains the updated row with `"teacherAccepted": true`.

- [ ] **Step 4: Commit**

```bash
git add backend/src/grading/grading.controller.ts
git commit -m "feat: add PATCH /grading/checkpoint-result/:id/teacher-accepted route"
```

---

### Task 5: `SubmissionsService.findOne` mapping

**Files:**
- Modify: `backend/src/submissions/submissions.service.ts:563-573`

**Interfaces:**
- Consumes: Prisma `CheckpointResult.teacherAccepted` (Task 1).
- Produces: `findOne()` response `checkpointResults[].teacherAccepted: boolean | null`, consumed by Task 6 (frontend `Submission` type) and ultimately Task 9 (`GradingAccordion`).

- [ ] **Step 1: Add the field to the mapped checkpoint result**

In `backend/src/submissions/submissions.service.ts`, inside `findOne()`, update the `checkpointResults.map` block:

```typescript
            checkpointResults: submission.gradingResult.checkpointResults.map((cr) => ({
              id: cr.id,
              checkpointId: cr.checkpointId,
              checkpointDescription: cr.checkpoint.description,
              checkpointOrder: cr.checkpoint.order,
              matched: cr.matched,
              matchedSnippets: cr.matchedSnippets,
              llmMatched: cr.llmMatched,
              llmMatchedSnippets: cr.llmMatchedSnippets,
              regexFailureExplanation: cr.regexFailureExplanation ?? null,
              teacherAccepted: cr.teacherAccepted,
            })),
```

- [ ] **Step 2: Verify it compiles**

Run from `backend/`: `npx tsc --noEmit -p tsconfig.json`
Expected: exits 0, no errors.

- [ ] **Step 3: Manual smoke test**

With the backend running, `curl` (or browser network tab while logged in) `GET /api/submissions/<submissionId>` for a submission that has a grading result. Expected: each entry in `gradingResult.checkpointResults` now has a `teacherAccepted` key (`null` until Task 4's smoke test set one to `true`).

- [ ] **Step 4: Commit**

```bash
git add backend/src/submissions/submissions.service.ts
git commit -m "feat: include teacherAccepted in submission detail response"
```

---

### Task 6: Frontend `api.ts`

**Files:**
- Modify: `frontend/src/lib/api.ts`

**Interfaces:**
- Consumes: `PATCH /api/grading/checkpoint-result/:id/teacher-accepted` (Task 4).
- Produces: `Submission.gradingResult.checkpointResults[].teacherAccepted?: boolean | null`, consumed by Task 8 (`helpers.ts`); `api.grading.updateCheckpointTeacherAccepted(checkpointResultId: string, teacherAccepted: boolean): Promise<void>`, consumed by Task 7 (hook).

- [ ] **Step 1: Extend the `Submission` type**

In `frontend/src/lib/api.ts`, inside the `Submission` interface's `checkpointResults` array type (around line 70-80), add `teacherAccepted`:

```typescript
    checkpointResults?: Array<{
      id: string;
      checkpointId: string;
      checkpointDescription: string;
      checkpointOrder: number;
      matched: boolean;
      matchedSnippets: Array<{ file?: string; line: number; snippet: string } | string>;
      llmMatched?: boolean;
      llmMatchedSnippets?: Array<{ file?: string; line: number; snippet: string } | string>;
      regexFailureExplanation?: string | null;
      teacherAccepted?: boolean | null;
    }>;
```

- [ ] **Step 2: Replace `updateTeacherScore` with `updateCheckpointTeacherAccepted`**

In the `grading` section of the `api` object (around line 263-276), replace:

```typescript
    updateTeacherScore: async (submissionId: string, teacherScore: number): Promise<void> => {
      await httpClient.patch(`/api/grading/submission/${submissionId}/teacher-score`, {
        teacherScore,
      });
    },
```

with:

```typescript
    updateCheckpointTeacherAccepted: async (
      checkpointResultId: string,
      teacherAccepted: boolean,
    ): Promise<void> => {
      await httpClient.patch(`/api/grading/checkpoint-result/${checkpointResultId}/teacher-accepted`, {
        teacherAccepted,
      });
    },
```

- [ ] **Step 3: Verify it compiles**

Run from `frontend/`: `npx tsc --noEmit`
Expected: errors only in `use-save-teacher-score.ts` and `SubmissionDetail/index.tsx` (not yet updated — Tasks 7 and 10). No errors in `api.ts` itself.

- [ ] **Step 4: Commit**

```bash
git add frontend/src/lib/api.ts
git commit -m "feat: replace updateTeacherScore API with updateCheckpointTeacherAccepted"
```

---

### Task 7: Frontend mutation hook

**Files:**
- Delete: `frontend/src/hooks/use-save-teacher-score.ts`
- Create: `frontend/src/hooks/use-update-checkpoint-teacher-accepted.ts`

**Interfaces:**
- Consumes: `api.grading.updateCheckpointTeacherAccepted` (Task 6).
- Produces: `useUpdateCheckpointTeacherAccepted(options?)` returning a React Query mutation with variables `{ checkpointResultId: string; teacherAccepted: boolean }`, consumed by Task 10 (`SubmissionDetail`).

- [ ] **Step 1: Delete the old hook**

```bash
rm frontend/src/hooks/use-save-teacher-score.ts
```

- [ ] **Step 2: Create the new hook**

Create `frontend/src/hooks/use-update-checkpoint-teacher-accepted.ts`:

```typescript
import { api } from '@/lib/api';
import { UseMutationOptions, useMutation } from '@tanstack/react-query';

interface UpdateCheckpointTeacherAcceptedVars {
  checkpointResultId: string;
  teacherAccepted: boolean;
}

export function useUpdateCheckpointTeacherAccepted(
  options?: Omit<UseMutationOptions<void, Error, UpdateCheckpointTeacherAcceptedVars>, 'mutationFn'>,
) {
  return useMutation({
    mutationFn: ({ checkpointResultId, teacherAccepted }: UpdateCheckpointTeacherAcceptedVars) =>
      api.grading.updateCheckpointTeacherAccepted(checkpointResultId, teacherAccepted),
    ...options,
  });
}
```

- [ ] **Step 3: Verify it compiles**

Run from `frontend/`: `npx tsc --noEmit`
Expected: errors only in `SubmissionDetail/index.tsx` (still imports the deleted hook — fixed in Task 10). No errors from this new file.

- [ ] **Step 4: Commit**

```bash
git add frontend/src/hooks/use-update-checkpoint-teacher-accepted.ts
git rm frontend/src/hooks/use-save-teacher-score.ts
git commit -m "feat: add useUpdateCheckpointTeacherAccepted hook"
```

---

### Task 8: `helpers.ts` mapping

**Files:**
- Modify: `frontend/src/lib/helpers.ts`

**Interfaces:**
- Consumes: `Submission.gradingResult.checkpointResults[].teacherAccepted` (Task 6), `Submission.gradingResult.checkpointResults[].id`.
- Produces: `CheckpointAccordionItem.checkpointResultId: string` and `CheckpointAccordionItem.teacherAccepted?: boolean | null`, consumed by Task 9 (`GradingAccordion`).

- [ ] **Step 1: Pass through the new fields**

In `frontend/src/lib/helpers.ts`, update `mapCheckpointResultsToAccordionItems`:

```typescript
export function mapCheckpointResultsToAccordionItems(
  gradingResult: NonNullable<Submission['gradingResult']>,
): CheckpointAccordionItem[] {
  const hasRegex = gradingResult.passedCheckpoints != null;
  return (gradingResult.checkpointResults ?? []).map((cr) => ({
    checkpointId: cr.checkpointId,
    checkpointResultId: cr.id,
    checkpointDescription: cr.checkpointDescription,
    teacherAccepted: cr.teacherAccepted,
    ...(hasRegex && {
      regexMatched: cr.matched,
      regexSnippets: parseSnippets(cr.matchedSnippets),
      regexFailureExplanation: cr.regexFailureExplanation,
    }),
    ...(cr.llmMatched !== undefined && {
      llmMatched: cr.llmMatched,
      llmSnippets: parseSnippets(cr.llmMatchedSnippets ?? []),
    }),
  }));
}
```

(`cr.id` already exists on the type from Task 6's `checkpointResults` array — it's the `id: string` field already declared there.)

- [ ] **Step 2: Verify it compiles**

Run from `frontend/`: `npx tsc --noEmit`
Expected: errors referencing `checkpointResultId`/`teacherAccepted` not existing on `CheckpointAccordionItem` (fixed in Task 9). No errors originating from `helpers.ts` itself.

- [ ] **Step 3: Commit**

```bash
git add frontend/src/lib/helpers.ts
git commit -m "feat: pass checkpointResultId and teacherAccepted into accordion items"
```

---

### Task 9: `GradingAccordion` accept/reject controls

**Files:**
- Modify: `frontend/src/components/GradingAccordion/index.tsx`

**Interfaces:**
- Consumes: `CheckpointAccordionItem.checkpointResultId`, `.teacherAccepted` (Task 8).
- Produces: `GradingAccordionProps.onTeacherAcceptedChange?: (checkpointResultId: string, value: boolean) => void`, consumed by Task 10 (`SubmissionDetail`).

- [ ] **Step 1: Extend the interfaces and props**

In `frontend/src/components/GradingAccordion/index.tsx`, update the imports and interfaces:

```typescript
import {
  Accordion,
  AccordionButton,
  AccordionIcon,
  AccordionItem,
  AccordionPanel,
  Badge,
  Box,
  Code,
  Divider,
  HStack,
  IconButton,
  Text,
  VStack,
} from '@chakra-ui/react';
import { FiCheck, FiX } from 'react-icons/fi';

export interface SnippetMatch {
  file?: string;
  line: number;
  snippet: string;
}

export interface CheckpointAccordionItem {
  checkpointId: string;
  checkpointResultId: string;
  checkpointDescription: string;
  teacherAccepted?: boolean | null;
  regexMatched?: boolean;
  regexSnippets?: SnippetMatch[];
  regexFailureExplanation?: string | null;
  llmMatched?: boolean;
  llmSnippets?: SnippetMatch[];
}

interface GradingAccordionProps {
  items: CheckpointAccordionItem[];
  onTeacherAcceptedChange?: (checkpointResultId: string, value: boolean) => void;
}
```

- [ ] **Step 2: Add the controls to the accordion row**

Update the component signature and the `HStack mr={2}` badge block to add the accept/reject buttons:

```typescript
export function GradingAccordion({ items, onTeacherAcceptedChange }: GradingAccordionProps) {
  return (
    <Accordion allowMultiple>
      {items.map((item, index) => {
        const overallMatched = item.regexMatched || item.llmMatched;
        const hasRegex = item.regexMatched !== null && item.regexMatched !== undefined;
        const hasLlm = item.llmMatched !== null && item.llmMatched !== undefined;

        return (
          <AccordionItem key={item.checkpointId}>
            <h2>
              <AccordionButton>
                <Box flex="1" textAlign="left">
                  <HStack>
                    {overallMatched ? <FiCheck color="green" /> : <FiX color="red" />}
                    <Text fontWeight="medium">
                      Checkpoint {index + 1}: {item.checkpointDescription}
                    </Text>
                  </HStack>
                </Box>
                <HStack mr={2} spacing={1}>
                  {hasRegex && (
                    <Badge colorScheme={item.regexMatched ? 'green' : 'red'} fontSize="xs">
                      Regex: {item.regexMatched ? 'ΠΕΤΥΧΕ' : 'ΑΠΕΤΥΧΕ'}
                    </Badge>
                  )}
                  {hasLlm && (
                    <Badge colorScheme={item.llmMatched ? 'green' : 'red'} fontSize="xs">
                      LLM: {item.llmMatched ? 'ΠΕΤΥΧΕ' : 'ΑΠΕΤΥΧΕ'}
                    </Badge>
                  )}
                </HStack>
                {onTeacherAcceptedChange && (
                  <HStack mr={2} spacing={1} onClick={(e) => e.stopPropagation()}>
                    <IconButton
                      aria-label="Αποδοχή από καθηγητή"
                      icon={<FiCheck />}
                      size="xs"
                      colorScheme={item.teacherAccepted === true ? 'green' : 'gray'}
                      variant={item.teacherAccepted === true ? 'solid' : 'outline'}
                      onClick={() => onTeacherAcceptedChange(item.checkpointResultId, true)}
                    />
                    <IconButton
                      aria-label="Απόρριψη από καθηγητή"
                      icon={<FiX />}
                      size="xs"
                      colorScheme={item.teacherAccepted === false ? 'red' : 'gray'}
                      variant={item.teacherAccepted === false ? 'solid' : 'outline'}
                      onClick={() => onTeacherAcceptedChange(item.checkpointResultId, false)}
                    />
                  </HStack>
                )}
                <AccordionIcon />
              </AccordionButton>
            </h2>
            <AccordionPanel pb={4}>
              <VStack align="stretch" spacing={3} divider={hasRegex && hasLlm ? <Divider /> : undefined}>
                {hasRegex && (
                  <Box>
                    <Badge colorScheme="brand" mb={2}>Regex Patterns</Badge>
                    {item.regexMatched && item.regexSnippets && item.regexSnippets.length > 0 ? (
                      <SnippetList snippets={item.regexSnippets} />
                    ) : (
                      <Text color="gray.500" fontSize="sm">
                        Δεν βρέθηκαν αποτελέσματα για αυτό το checkpoint
                      </Text>
                    )}
                    {!item.regexMatched && item.regexFailureExplanation && (
                      <Box mt={2} p={2} bg="orange.900" borderRadius="md">
                        <Text fontSize="xs" color="orange.200" fontWeight="medium" mb={1}>
                          Αιτιολόγηση Αποτυχίας
                        </Text>
                        <Text fontSize="sm" color="orange.100">
                          {item.regexFailureExplanation}
                        </Text>
                      </Box>
                    )}
                  </Box>
                )}
                {hasLlm && (
                  <Box>
                    <Badge colorScheme="purple" mb={2}>LLM</Badge>
                    {item.llmMatched && item.llmSnippets && item.llmSnippets.length > 0 ? (
                      <SnippetList snippets={item.llmSnippets} colorScheme="purple" />
                    ) : (
                      <Text color="gray.500" fontSize="sm">
                        Δεν βρέθηκαν αποτελέσματα για αυτό το checkpoint
                      </Text>
                    )}
                  </Box>
                )}
              </VStack>
            </AccordionPanel>
          </AccordionItem>
        );
      })}
    </Accordion>
  );
}
```

(`SnippetList` is unchanged — leave it exactly as-is above this block.)

- [ ] **Step 3: Verify it compiles**

Run from `frontend/`: `npx tsc --noEmit`
Expected: no errors in `GradingAccordion/index.tsx`. Remaining errors (if any) should only be in `SubmissionDetail/index.tsx` (Task 10).

- [ ] **Step 4: Commit**

```bash
git add frontend/src/components/GradingAccordion/index.tsx
git commit -m "feat: add per-checkpoint accept/reject controls to GradingAccordion"
```

---

### Task 10: `SubmissionDetail` — remove modal, wire new controls

**Files:**
- Modify: `frontend/src/components/SubmissionDetail/index.tsx`

**Interfaces:**
- Consumes: `useUpdateCheckpointTeacherAccepted` (Task 7), `GradingAccordion`'s `onTeacherAcceptedChange` prop (Task 9).

- [ ] **Step 1: Rewrite the file**

Replace the full contents of `frontend/src/components/SubmissionDetail/index.tsx` with:

```typescript
import { DownloadButton } from '@/components/DownloadButton';
import { ExplainRegexFailuresButton } from '@/components/ExplainRegexFailuresButton';
import { GradingAccordion } from '@/components/GradingAccordion';
import { useRegradeSubmission } from '@/hooks/use-regrade-submission';
import { useUpdateCheckpointTeacherAccepted } from '@/hooks/use-update-checkpoint-teacher-accepted';
import { ExerciseType, Submission } from '@/lib/api';
import { mapCheckpointResultsToAccordionItems } from '@/lib/helpers';
import { QueryKeys } from '@/lib/queryKeys';
import {
  Badge,
  Box,
  Button,
  Card,
  CardBody,
  Heading,
  HStack,
  Text,
  VStack,
  useToast,
} from '@chakra-ui/react';
import { useQueryClient } from '@tanstack/react-query';
import { FiRefreshCw } from 'react-icons/fi';

interface SubmissionDetailProps {
  submission: Submission;
  exerciseType?: ExerciseType;
}

export function SubmissionDetail({ submission, exerciseType }: SubmissionDetailProps) {
  const isProject = (exerciseType ?? submission.exerciseType) === ExerciseType.PROJECT;
  const toast = useToast();
  const queryClient = useQueryClient();

  const updateTeacherAcceptedMutation = useUpdateCheckpointTeacherAccepted({
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [QueryKeys.Submissions, submission.id] });
    },
    onError: () => {
      toast({ title: 'Σφάλμα αποθήκευσης βαθμολογίας', status: 'error', duration: 3000 });
    },
  });

  const handleTeacherAcceptedChange = (checkpointResultId: string, value: boolean) => {
    updateTeacherAcceptedMutation.mutate({ checkpointResultId, teacherAccepted: value });
  };

  const regradeMutation = useRegradeSubmission({
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [QueryKeys.Submissions, submission.id] });
      toast({ title: 'Η βαθμολόγηση ολοκληρώθηκε', status: 'success', duration: 3000 });
    },
    onError: () => {
      toast({ title: 'Σφάλμα βαθμολόγησης', status: 'error', duration: 3000 });
    },
  });

  const handleRegrade = (method: 'regex' | 'llm') => {
    regradeMutation.mutate({ submissionId: submission.id, method });
  };

  const failedCheckpointResults = (submission.gradingResult?.checkpointResults ?? []).filter(
    (cr) => cr.matched === false,
  );
  const hasFailedRegexCheckpoints = !isProject && failedCheckpointResults.length > 0;

  return (
    <VStack align="stretch" spacing={6}>
      <Heading size="md">{submission.exerciseTitle}</Heading>

      {/* File Info */}
      <Card>
        <CardBody>
          <HStack justify="space-between">
            <VStack align="start" spacing={1}>
              <Text fontWeight="bold">Αρχείο Υποβολής</Text>
              <Text fontSize="sm" color="gray.400">
                {submission.fileName} ({submission.fileType}) •{' '}
                {new Date(submission.createdAt).toLocaleDateString('el-GR')}
              </Text>
            </VStack>
            <DownloadButton
              url={`${import.meta.env.VITE_API_BASE_URL}/api/submissions/${submission.id}/download`}
              colorScheme="blue"
            />
          </HStack>
        </CardBody>
      </Card>

      {/* Participating Students */}
      {submission.students.length > 0 && (
        <Card>
          <CardBody>
            <Text fontWeight="medium" mb={2}>
              Συμμετέχοντες Φοιτητές
            </Text>
            <HStack flexWrap="wrap" gap={2}>
              {submission.students.map((s) => (
                <Badge key={s.id} colorScheme="purple">
                  {s.lastName} {s.firstName} - {s.studentIdentifier}
                </Badge>
              ))}
            </HStack>
          </CardBody>
        </Card>
      )}

      {/* Grading Results */}
      {submission.gradingResult ? (
        <Card>
          <CardBody>
            <VStack align="stretch" spacing={4}>
              <HStack justify="space-between">
                <Text fontWeight="bold">Αποτελέσματα Βαθμολόγησης</Text>
                <HStack>
                  {!isProject && (
                    <Button
                      leftIcon={<FiRefreshCw />}
                      size="sm"
                      variant="outline"
                      colorScheme="teal"
                      onClick={() => handleRegrade('regex')}
                      isLoading={regradeMutation.isPending && regradeMutation.variables?.method === 'regex'}
                      isDisabled={regradeMutation.isPending}
                    >
                      Regex
                    </Button>
                  )}
                  <Button
                    leftIcon={<FiRefreshCw />}
                    size="sm"
                    variant="outline"
                    colorScheme="purple"
                    onClick={() => handleRegrade('llm')}
                    isLoading={regradeMutation.isPending && regradeMutation.variables?.method === 'llm'}
                    isDisabled={regradeMutation.isPending}
                  >
                    LLM
                  </Button>
                  <ExplainRegexFailuresButton
                    submissionId={submission.id}
                    hasFailedRegex={hasFailedRegexCheckpoints}
                    isDisabled={regradeMutation.isPending}
                    onExplained={() => queryClient.invalidateQueries({ queryKey: [QueryKeys.Submissions, submission.id] })}
                  />
                </HStack>
              </HStack>

              {/* Summary */}
              <HStack spacing={12} p={3} bg="gray.700" borderRadius="md">
                {!isProject && submission.gradingResult.passedCheckpoints != null && submission.gradingResult.passedCheckpoints != undefined && (
                  <VStack align="start" spacing={0}>
                    <Text fontSize="xs" color="gray.400">
                      Βαθμός Regex
                    </Text>
                    <HStack>
                      <Text fontWeight="bold">
                        {submission.gradingResult.passedCheckpoints}/
                        {submission.gradingResult.totalCheckpoints}
                      </Text>
                      <Badge
                        colorScheme={submission.gradingResult.score >= 50 ? 'green' : 'red'}
                      >
                        {Math.round(submission.gradingResult.score)}%
                      </Badge>
                    </HStack>
                  </VStack>
                )}
                {submission.gradingResult.llmScore != null && (
                  <VStack align="start" spacing={0}>
                    <Text fontSize="xs" color="gray.400">
                      Βαθμός LLM
                    </Text>
                    <HStack>
                      <Text fontWeight="bold">
                        {submission.gradingResult.llmPassedCheckpoints}/
                        {submission.gradingResult.totalCheckpoints}
                      </Text>
                      <Badge
                        colorScheme={submission.gradingResult.llmScore >= 50 ? 'green' : 'red'}
                      >
                        {Math.round(submission.gradingResult.llmScore)}%
                      </Badge>
                    </HStack>
                  </VStack>
                )}
                {submission.gradingResult.teacherScore != null && (
                  <VStack align="start" spacing={0}>
                    <Text fontSize="xs" color="gray.400">
                      Βαθμός Καθηγητή
                    </Text>
                    <HStack>
                      <Text fontWeight="bold">
                        {submission.gradingResult.teacherScore}/
                        {submission.gradingResult.totalCheckpoints}
                      </Text>
                      <Badge colorScheme="blue">
                        {Math.round(
                          (submission.gradingResult.teacherScore /
                            submission.gradingResult.totalCheckpoints) *
                          100,
                        )}
                        %
                      </Badge>
                    </HStack>
                  </VStack>
                )}
              </HStack>

              {/* Checkpoint Results */}
              <GradingAccordion
                items={mapCheckpointResultsToAccordionItems(submission.gradingResult)}
                onTeacherAcceptedChange={handleTeacherAcceptedChange}
              />
            </VStack>
          </CardBody>
        </Card>
      ) : (
        <Box p={4} bg="yellow.900" borderRadius="md">
          <HStack justify="space-between">
            <Text fontSize="sm" color="yellow.300">
              Η εργασία δεν έχει βαθμολογηθεί ακόμα
            </Text>
            <HStack>
              {!isProject && (
                <Button
                  leftIcon={<FiRefreshCw />}
                  size="sm"
                  variant="outline"
                  colorScheme="teal"
                  onClick={() => handleRegrade('regex')}
                  isLoading={regradeMutation.isPending && regradeMutation.variables?.method === 'regex'}
                  isDisabled={regradeMutation.isPending}
                >
                  Regex
                </Button>
              )}
              <Button
                leftIcon={<FiRefreshCw />}
                size="sm"
                variant="outline"
                colorScheme="purple"
                onClick={() => handleRegrade('llm')}
                isLoading={regradeMutation.isPending && regradeMutation.variables?.method === 'llm'}
                isDisabled={regradeMutation.isPending}
              >
                LLM
              </Button>
            </HStack>
          </HStack>
        </Box>
      )}

      {/* Project Report */}
      {isProject && submission.gradingResult?.projectReport && (
        <Card>
          <CardBody>
            <VStack align="stretch" spacing={2}>
              <HStack justify="space-between">
                <Text fontWeight="bold">Project Report</Text>
                {submission.gradingResult.projectReportAt && (
                  <Text fontSize="xs" color="gray.500">
                    {new Date(submission.gradingResult.projectReportAt).toLocaleDateString('el-GR', {
                      day: '2-digit',
                      month: '2-digit',
                      year: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </Text>
                )}
              </HStack>
              <Text fontSize="sm" lineHeight="tall" color="gray.200">
                {submission.gradingResult.projectReport}
              </Text>
            </VStack>
          </CardBody>
        </Card>
      )}
    </VStack>
  );
}
```

- [ ] **Step 2: Verify it compiles**

Run from `frontend/`: `npx tsc --noEmit`
Expected: exits 0, no errors anywhere in the project.

- [ ] **Step 3: Commit**

```bash
git add frontend/src/components/SubmissionDetail/index.tsx
git commit -m "feat: remove manual teacher-score modal, wire per-checkpoint accept/reject"
```

---

### Task 11: Manual end-to-end verification

**Files:** none (verification only)

- [ ] **Step 1: Start all three services**

```bash
# terminal 1
cd backend && npm run start:dev
# terminal 2
cd frontend && npm run dev
# terminal 3 (only if not already running)
cd python-service && uvicorn main:app --reload
```

- [ ] **Step 2: Open a graded submission in the browser**

Navigate to `http://localhost:3000`, log in, open an exercise that has at least one graded submission, click into the submission detail page.

- [ ] **Step 3: Confirm the old button is gone**

Confirm there is no "Επεξεργασία Βαθμού" / "Προσθήκη Βαθμού" button in the "Αποτελέσματα Βαθμολόγησης" card header.

- [ ] **Step 4: Confirm "Βαθμός Καθηγητή" is hidden before any review**

If no checkpoint has ever been accepted/rejected for this submission, confirm the "Βαθμός Καθηγητή" summary tile is absent.

- [ ] **Step 5: Accept/reject checkpoints and confirm the score updates**

Expand a checkpoint in the accordion, click the green checkmark icon button. Confirm: the button highlights solid green, a "Βαθμός Καθηγητή" tile appears showing `1/<total>` and the matching percentage. Click the red X on a second checkpoint; confirm the count does not increase. Reload the page; confirm both decisions persisted (buttons still show their accepted/rejected state).

- [ ] **Step 6: Confirm clicking the buttons doesn't toggle the accordion panel**

Click the accept/reject buttons on a collapsed checkpoint; confirm the accordion panel does not expand/collapse as a side effect.

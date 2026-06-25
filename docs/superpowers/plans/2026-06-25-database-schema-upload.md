# Database Schema Upload Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let a professor optionally upload a `.txt` database-schema file on the exercise detail page; store its text on the exercise; show it in a full-height view modal; and feed it into the pattern-generation LLM prompt when present.

**Architecture:** One new nullable `databaseSchema` column on `Exercise`. Two new NestJS endpoints (`POST`/`DELETE /exercises/:id/schema`) read/clear that column. `LlmService.streamPatternResponse` forwards it to the Python `/generate-patterns` call as `database_schema`. The Python side gets a new `build_schema_text` helper (mirrors `build_rules_text`) injected into `USER_PROMPT_PATTERNS`. The frontend gets a new `SchemaCard` component (mirrors `RulesCard`) rendered above the Rules card, plus a full-screen Chakra modal for viewing the text.

**Tech Stack:** NestJS + Prisma + Postgres (backend), FastAPI + Pydantic + LangChain (python-service), React + Chakra UI + React Query (frontend).

## Global Constraints

- Schema upload only applies to `EXERCISE`-type exercises (gated the same as `RulesCard`, i.e. `!isProject`) — spec section "Out of Scope".
- Only `.txt` files are accepted for the schema upload — spec "Backend (NestJS)".
- The schema is injected **only** into the pattern-generation prompt, never the checkpoint-generation prompt — spec "Backend → Python (pattern prompt only)".
- Re-uploading replaces the previous schema text; a delete action clears it to `null` — spec "Data Model" / brainstorm decision.
- View modal is a Chakra `Modal size="full"` — brainstorm decision.
- Follow existing Greek-language UI copy conventions (see `RulesCard.tsx`).
- `prisma/migrations/` is gitignored in this repo — do not try to git-add the generated migration folder.

---

### Task 1: Add `databaseSchema` column to `Exercise` (Prisma)

**Files:**
- Modify: `backend/prisma/schema.prisma:10-28` (the `Exercise` model)

**Interfaces:**
- Produces: `Exercise.databaseSchema: string | null` available to all Prisma queries on `Exercise` from this point on.

- [ ] **Step 1: Add the column to the schema**

In `backend/prisma/schema.prisma`, inside `model Exercise`, add the new field next to `extractedText`:

```prisma
model Exercise {
  id            String         @id @default(uuid())
  title         String
  fileName      String?
  pdfUrl        String
  status        ExerciseStatus @default(DRAFT)
  createdAt     DateTime       @default(now())
  updatedAt     DateTime       @updatedAt
  extractedText String?
  databaseSchema String?
  teacherid     String
  exerciseType  ExerciseType   @default(EXERCISE)
  checkpoints   Checkpoint[]
  rules         Rule[]
  conversations Conversation[]
  users         users          @relation(fields: [teacherid], references: [id], onDelete: NoAction, onUpdate: NoAction, map: "exercises_fk")
  submissions   Submission[]

  @@map("exercises")
}
```

- [ ] **Step 2: Generate and apply the migration**

Run from `backend/`:

```bash
npx prisma migrate dev --name add_database_schema_to_exercise
```

Expected: command completes with `Your database is now in sync with your schema.` and regenerates the Prisma client.

- [ ] **Step 3: Verify the client picked up the field**

Run:

```bash
npx prisma validate
```

Expected: `The schema at prisma/schema.prisma is valid 🚀`

- [ ] **Step 4: Commit**

```bash
git add backend/prisma/schema.prisma
git commit -m "feat: add databaseSchema column to Exercise"
```

---

### Task 2: Backend service + DTO — read/write `databaseSchema`

**Files:**
- Modify: `backend/src/exercises/dto/exercise.dto.ts`
- Modify: `backend/src/exercises/exercises.service.ts`

**Interfaces:**
- Consumes: `Exercise.databaseSchema` from Task 1.
- Produces: `ExercisesService.setSchema(id: string, databaseSchema: string | null): Promise<ExerciseResponseDto>`; `ExerciseResponseDto.databaseSchema?: string`. Both are consumed by Task 3 (controller).

- [ ] **Step 1: Add `databaseSchema` to `ExerciseResponseDto`**

In `backend/src/exercises/dto/exercise.dto.ts`, add the field to `ExerciseResponseDto` (after `originalPdfPath`):

```typescript
export class ExerciseResponseDto {
  id: string;

  title: string;

  fileName?: string;

  originalPdfPath: string;

  databaseSchema?: string;

  // extractedText?: string;

  status: "draft" | "approved";

  exerciseType: "exercise" | "project";

  createdAt: string;

  updatedAt: string;

  checkpointCount?: number;

  submissionCount?: number;
}
```

- [ ] **Step 2: Add `setSchema` to `ExercisesService` and map the field**

In `backend/src/exercises/exercises.service.ts`, add a `setSchema` method (placed right after `approve`) and update `mapToResponseDto`:

```typescript
  async setSchema(
    id: string,
    databaseSchema: string | null,
  ): Promise<ExerciseResponseDto> {
    try {
      const exercise = await this.prisma.exercise.update({
        where: { id },
        data: { databaseSchema },
        include: {
          checkpoints: true,
          submissions: true,
        },
      });

      return this.mapToResponseDto(exercise);
    } catch (error) {
      throw new NotFoundException(`Exercise with ID ${id} not found`);
    }
  }
```

And in `mapToResponseDto`, add the field to the returned object (right after `originalPdfPath`):

```typescript
  private mapToResponseDto(exercise: any): ExerciseResponseDto {
    return {
      id: exercise.id,
      title: exercise.title,
      fileName: exercise.fileName,
      originalPdfPath: exercise.pdfUrl,
      databaseSchema: exercise.databaseSchema ?? undefined,
      status: exercise.status.toLowerCase() as "draft" | "approved",
      exerciseType: exercise.exerciseType.toLowerCase() as
        | "exercise"
        | "project",
      createdAt: exercise.createdAt.toISOString(),
      updatedAt: exercise.updatedAt.toISOString(),
      checkpointCount: exercise.checkpoints?.length || 0,
      submissionCount: exercise.submissions?.length || 0,
    };
  }
```

- [ ] **Step 3: Verify it compiles**

Run from `backend/`:

```bash
npx tsc --noEmit -p tsconfig.json
```

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add backend/src/exercises/dto/exercise.dto.ts backend/src/exercises/exercises.service.ts
git commit -m "feat: add setSchema method and databaseSchema field to exercise DTO"
```

---

### Task 3: Backend controller — upload/delete schema endpoints

**Files:**
- Modify: `backend/src/exercises/exercises.controller.ts`

**Interfaces:**
- Consumes: `ExercisesService.setSchema(id, databaseSchema)` from Task 2.
- Produces: `POST /exercises/:id/schema` (multipart, field name `file`) and `DELETE /exercises/:id/schema`, both returning `ExerciseResponseDto`. Consumed by the frontend in Task 8.

- [ ] **Step 1: Add the upload endpoint**

In `backend/src/exercises/exercises.controller.ts`, add a new endpoint after `approve` (before `remove`). It reuses the same `FileInterceptor`/`diskStorage`/`BadRequestException` style already used by `uploadExercise`, but stores under `./uploads/schemas` and restricts to `.txt`:

```typescript
  @Post(":id/schema")
  @UseInterceptors(
    FileInterceptor("file", {
      storage: diskStorage({
        destination: "./uploads/schemas",
        filename: (req, file, callback) => {
          const uniqueSuffix =
            Date.now() + "-" + Math.round(Math.random() * 1e9);
          const ext = extname(file.originalname);
          callback(null, `schema-${uniqueSuffix}${ext}`);
        },
      }),
      fileFilter: (req, file, callback) => {
        if (extname(file.originalname).toLowerCase() !== ".txt") {
          return callback(
            new BadRequestException("Only .txt files are allowed"),
            false,
          );
        }
        callback(null, true);
      },
      limits: {
        fileSize: 5 * 1024 * 1024, // 5MB
      },
    }),
  )
  async uploadSchema(
    @Param("id") id: string,
    @UploadedFile() file: Express.Multer.File,
  ): Promise<ExerciseResponseDto> {
    if (!file) {
      throw new BadRequestException("File is required");
    }

    const databaseSchema = fs.readFileSync(file.path, "utf8");
    fs.unlinkSync(file.path);

    return this.exercisesService.setSchema(id, databaseSchema);
  }

  @Delete(":id/schema")
  removeSchema(@Param("id") id: string): Promise<ExerciseResponseDto> {
    return this.exercisesService.setSchema(id, null);
  }
```

Note: `fs.unlinkSync` removes the temp upload after reading its contents into the DB — we only persist the extracted text, not the file itself (spec: "no disk persistence needed").

- [ ] **Step 2: Ensure the upload directory exists**

The existing `./uploads/exercises` directory is created ahead of time for the app (check by running the dev server once — multer's `diskStorage` does not auto-create destination directories). Create the directory so the first upload doesn't fail:

```bash
mkdir -p backend/uploads/schemas
```

If `backend/uploads/exercises` has a `.gitkeep` file, add one here too for consistency:

```bash
ls backend/uploads/exercises | grep -i gitkeep || true
```

If that prints a filename, create the matching file:

```bash
touch backend/uploads/schemas/.gitkeep
```

- [ ] **Step 3: Verify it compiles**

```bash
cd backend && npx tsc --noEmit -p tsconfig.json
```

Expected: no errors.

- [ ] **Step 4: Manual verification against a running server**

Start the backend (`npm run start:dev` from `backend/`), then in another terminal, using a real exercise id and auth cookie/token from your browser session (replace `<EXERCISE_ID>` and `<COOKIE>`):

```bash
echo "CREATE TABLE students (id INT);" > /tmp/schema.txt
curl -i -X POST "http://localhost:3001/exercises/<EXERCISE_ID>/schema" \
  -H "Cookie: <COOKIE>" \
  -F "file=@/tmp/schema.txt"
```

Expected: `200 OK` JSON body with `"databaseSchema":"CREATE TABLE students (id INT);\n"`.

```bash
curl -i -X DELETE "http://localhost:3001/exercises/<EXERCISE_ID>/schema" \
  -H "Cookie: <COOKIE>"
```

Expected: `200 OK` JSON body with `"databaseSchema":null` (or the key omitted, since `mapToResponseDto` uses `?? undefined`).

- [ ] **Step 5: Commit**

```bash
git add backend/src/exercises/exercises.controller.ts backend/uploads/schemas
git commit -m "feat: add upload/delete endpoints for exercise database schema"
```

---

### Task 4: Forward `databaseSchema` to the pattern-generation call

**Files:**
- Modify: `backend/src/llm/llm.service.ts:155-211` (`streamPatternResponse`)

**Interfaces:**
- Consumes: `exercise.databaseSchema` (Prisma field from Task 1), already-fetched in this method.
- Produces: `database_schema` field on the JSON body posted to `${pythonServiceUrl}/generate-patterns`. Consumed by Task 5/6 on the Python side.

- [ ] **Step 1: Pass the field through**

In `backend/src/llm/llm.service.ts`, the `streamPatternResponse` method currently loads `checkpoints` and `rules` but not the `exercise` row. Add the exercise lookup and pass `database_schema` in the axios POST body:

```typescript
  async *streamPatternResponse(
    exerciseId: string,
    message: string,
  ): AsyncGenerator<string> {
    await this.saveMessage(
      exerciseId,
      ConversationRole.PROFESSOR,
      message,
      ConversationType.PATTERN,
    );

    const history = await this.getConversationHistory(
      exerciseId,
      ConversationType.PATTERN,
    );

    const exercise = await this.prisma.exercise.findUnique({
      where: { id: exerciseId },
    });

    if (!exercise) {
      throw new NotFoundException(`Exercise with ID ${exerciseId} not found`);
    }

    const checkpoints = await this.prisma.checkpoint.findMany({
      where: { exerciseId },
      orderBy: { order: "asc" },
    });

    const rules = await this.prisma.rule.findMany({
      where: { exerciseId },
      orderBy: { order: "asc" },
    });

    if (checkpoints.length === 0) {
      throw new NotFoundException(
        `No checkpoints found for exercise ${exerciseId}`,
      );
    }

    // Use patterns from the latest assistant response if the user hasn't accepted yet,
    // so unaccepted changes aren't lost when a follow-up message is sent.
    const pendingPatterns = this.extractPendingPatterns(history.slice(0, -1));

    try {
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
          database_schema: exercise.databaseSchema ?? undefined,
          history: history.slice(0, -1).map((msg) => ({
            role: msg.role.toLowerCase(),
            content: msg.content,
          })),
        },
        {
          responseType: "stream",
          timeout: 120000,
        },
      );
```

(The rest of the method — streaming the response and saving the assistant message — is unchanged.)

- [ ] **Step 2: Verify it compiles**

```bash
cd backend && npx tsc --noEmit -p tsconfig.json
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add backend/src/llm/llm.service.ts
git commit -m "feat: forward exercise database schema to pattern generation"
```

---

### Task 5: Python — accept `database_schema` on `GeneratePatternsRequest`

**Files:**
- Modify: `python-service/models.py:30-36`

**Interfaces:**
- Produces: `GeneratePatternsRequest.database_schema: Optional[str]`. Consumed by Task 6.

- [ ] **Step 1: Add the field**

In `python-service/models.py`, update `GeneratePatternsRequest`:

```python
class GeneratePatternsRequest(BaseModel):
    """Request body for /generate-patterns endpoint."""
    checkpoints: list[CheckpointInfo] = Field(..., description="List of checkpoints to generate patterns for")
    extracted_text: str = Field(default="", description="Original exercise text for context")
    history: list[Message] = Field(default_factory=list, description="Pattern conversation history")
    message: str = Field(..., description="Current professor message")
    rules: list[str] = Field(default_factory=list, description="Teacher-supplied standing rules")
    database_schema: Optional[str] = Field(default=None, description="Optional professor-supplied database schema text")
```

- [ ] **Step 2: Verify the module imports cleanly**

Run from `python-service/`:

```bash
python -c "from models import GeneratePatternsRequest; print(GeneratePatternsRequest(checkpoints=[], message='x').database_schema)"
```

Expected output: `None`

- [ ] **Step 3: Commit**

```bash
git add python-service/models.py
git commit -m "feat: add database_schema field to GeneratePatternsRequest"
```

---

### Task 6: Python — `build_schema_text` helper + wire into pattern prompt

**Files:**
- Modify: `python-service/services/llm_service.py` (add helper near `build_rules_text`; update `_build_pattern_messages`)
- Modify: `python-service/prompts/patterns_prompts.py:345-368` (`USER_PROMPT_PATTERNS`)
- Test: `python-service/tests/test_llm.py`

**Interfaces:**
- Consumes: `GeneratePatternsRequest.database_schema` from Task 5.
- Produces: `build_schema_text(schema: Optional[str]) -> str`, used only inside `_build_pattern_messages`.

- [ ] **Step 1: Write the failing test**

In `python-service/tests/test_llm.py`, add these two tests after `test_build_rules_text_with_rules`:

```python
def test_build_schema_text_empty():
    from services.llm_service import build_schema_text

    assert build_schema_text(None) == ""
    assert build_schema_text("") == ""


def test_build_schema_text_with_schema():
    from services.llm_service import build_schema_text

    result = build_schema_text("CREATE TABLE students (id INT);")

    assert result == "Σχήμα βάσης δεδομένων:\nCREATE TABLE students (id INT);\n\n"
```

- [ ] **Step 2: Run the test to verify it fails**

Run from `python-service/`:

```bash
pytest tests/test_llm.py::test_build_schema_text_empty tests/test_llm.py::test_build_schema_text_with_schema -v
```

Expected: both `FAIL` with `ImportError: cannot import name 'build_schema_text'`.

- [ ] **Step 3: Implement `build_schema_text`**

In `python-service/services/llm_service.py`, add the helper immediately after `build_rules_text` (around line 36):

```python
def build_schema_text(schema: str | None) -> str:
    """Build the database-schema sentence injected into the patterns prompt, or '' if absent."""
    if not schema:
        return ""
    return f"Σχήμα βάσης δεδομένων:\n{schema}\n\n"
```

- [ ] **Step 4: Run the test to verify it passes**

```bash
pytest tests/test_llm.py::test_build_schema_text_empty tests/test_llm.py::test_build_schema_text_with_schema -v
```

Expected: both `PASS`.

- [ ] **Step 5: Add the `{schema_text}` placeholder to the prompt template**

In `python-service/prompts/patterns_prompts.py`, change the `USER_PROMPT_PATTERNS` line that currently reads:

```python
{rules_text}Οδηγίες καθηγητή: {message}
```

to:

```python
{schema_text}{rules_text}Οδηγίες καθηγητή: {message}
```

- [ ] **Step 6: Pass `schema_text` when formatting the prompt**

In `python-service/services/llm_service.py`, in `_build_pattern_messages`, update the `.format(...)` call:

```python
    user_content = USER_PROMPT_PATTERNS.format(
        checkpoints=checkpoints_json,
        extracted_text=request.extracted_text,
        message=request.message,
        rules_text=build_rules_text(request.rules),
        schema_text=build_schema_text(request.database_schema),
    )
```

- [ ] **Step 7: Run the full python-service test suite**

```bash
pytest -v
```

Expected: all tests pass, including the two new ones.

- [ ] **Step 8: Commit**

```bash
git add python-service/services/llm_service.py python-service/prompts/patterns_prompts.py python-service/tests/test_llm.py
git commit -m "feat: inject database schema text into pattern generation prompt"
```

---

### Task 7: Frontend API client — `databaseSchema`, `uploadSchema`, `deleteSchema`

**Files:**
- Modify: `frontend/src/lib/api.ts`

**Interfaces:**
- Produces: `Exercise.databaseSchema?: string`; `api.exercises.uploadSchema(id: string, file: File): Promise<Exercise>`; `api.exercises.deleteSchema(id: string): Promise<Exercise>`. Consumed by Task 8 (hooks) and Task 9 (component).

- [ ] **Step 1: Add `databaseSchema` to the `Exercise` interface**

In `frontend/src/lib/api.ts`, update the `Exercise` interface:

```typescript
export interface Exercise {
  id: string;
  title: string;
  fileName?: string;
  originalPdfPath: string;
  extractedText?: string;
  databaseSchema?: string;
  status: ExerciseStatus;
  exerciseType: ExerciseType;
  createdAt: string;
  updatedAt: string;
}
```

- [ ] **Step 2: Add the two API methods**

In the `exercises` section of the `api` object (right after `approve`), add:

```typescript
    uploadSchema: async (id: string, file: File): Promise<Exercise> => {
      const formData = new FormData();
      formData.append('file', file);
      const { data } = await httpClient.post(`/api/exercises/${id}/schema`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      return data;
    },
    deleteSchema: async (id: string): Promise<Exercise> => {
      const { data } = await httpClient.delete(`/api/exercises/${id}/schema`);
      return data;
    },
```

- [ ] **Step 3: Verify it compiles**

Run from `frontend/`:

```bash
npx tsc --noEmit -p tsconfig.json
```

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add frontend/src/lib/api.ts
git commit -m "feat: add uploadSchema/deleteSchema API client methods"
```

---

### Task 8: Frontend hooks — `useUploadSchema`, `useDeleteSchema`

**Files:**
- Create: `frontend/src/hooks/use-upload-schema.ts`
- Create: `frontend/src/hooks/use-delete-schema.ts`

**Interfaces:**
- Consumes: `api.exercises.uploadSchema`, `api.exercises.deleteSchema` from Task 7; `QueryKeys.Exercise` from `frontend/src/lib/queryKeys.ts`.
- Produces: `useUploadSchema(options?)` and `useDeleteSchema(options?)`, each a `useMutation` wrapper. Consumed by Task 10 (`SchemaCard`).

- [ ] **Step 1: Create `use-upload-schema.ts`**

```typescript
import { api, Exercise } from '@/lib/api';
import { UseMutationOptions, useMutation } from '@tanstack/react-query';

export function useUploadSchema(
  options?: Omit<UseMutationOptions<Exercise, Error, { exerciseId: string; file: File }>, 'mutationFn'>,
) {
  return useMutation({
    mutationFn: ({ exerciseId, file }) => api.exercises.uploadSchema(exerciseId, file),
    ...options,
  });
}
```

- [ ] **Step 2: Create `use-delete-schema.ts`**

```typescript
import { api, Exercise } from '@/lib/api';
import { UseMutationOptions, useMutation } from '@tanstack/react-query';

export function useDeleteSchema(
  options?: Omit<UseMutationOptions<Exercise, Error, { exerciseId: string }>, 'mutationFn'>,
) {
  return useMutation({
    mutationFn: ({ exerciseId }) => api.exercises.deleteSchema(exerciseId),
    ...options,
  });
}
```

- [ ] **Step 3: Verify it compiles**

```bash
cd frontend && npx tsc --noEmit -p tsconfig.json
```

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add frontend/src/hooks/use-upload-schema.ts frontend/src/hooks/use-delete-schema.ts
git commit -m "feat: add useUploadSchema and useDeleteSchema hooks"
```

---

### Task 9: Frontend — `SchemaCard` component with full-height view modal

**Files:**
- Create: `frontend/src/components/Exercise/SchemaCard.tsx`

**Interfaces:**
- Consumes: `useUploadSchema`, `useDeleteSchema` from Task 8; `QueryKeys.Exercise` from `frontend/src/lib/queryKeys.ts`.
- Produces: `SchemaCard({ exerciseId, schema }: { exerciseId: string; schema?: string })`. Consumed by Task 10 (`ExerciseDetailPage`).

- [ ] **Step 1: Write the component**

```tsx
import { useDeleteSchema } from '@/hooks/use-delete-schema';
import { useUploadSchema } from '@/hooks/use-upload-schema';
import { QueryKeys } from '@/lib/queryKeys';
import {
  Box,
  Button,
  Card,
  CardBody,
  Divider,
  HStack,
  Heading,
  IconButton,
  Input,
  Modal,
  ModalBody,
  ModalCloseButton,
  ModalContent,
  ModalHeader,
  ModalOverlay,
  Text,
  VStack,
  useDisclosure,
} from '@chakra-ui/react';
import { useQueryClient } from '@tanstack/react-query';
import { useRef, useState } from 'react';
import { FiDatabase, FiEye, FiUpload, FiX } from 'react-icons/fi';

interface SchemaCardProps {
  exerciseId: string;
  schema?: string;
}

export function SchemaCard({ exerciseId, schema }: SchemaCardProps) {
  const queryClient = useQueryClient();
  const { isOpen, onOpen, onClose } = useDisclosure();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: [QueryKeys.Exercise, exerciseId] });
  };

  const uploadMutation = useUploadSchema({
    onSuccess: () => {
      setSelectedFile(null);
      if (fileInputRef.current) fileInputRef.current.value = '';
      invalidate();
    },
  });

  const deleteMutation = useDeleteSchema({
    onSuccess: invalidate,
  });

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] ?? null;
    setSelectedFile(file);
  };

  const handleUpload = () => {
    if (!selectedFile) return;
    uploadMutation.mutate({ exerciseId, file: selectedFile });
  };

  return (
    <Card h="full">
      <CardBody>
        <VStack align="start" spacing={4}>
          <HStack>
            <FiDatabase size={24} />
            <Heading size="md">Σχήμα Βάσης Δεδομένων</Heading>
          </HStack>
          <Text fontSize="sm" color="gray.400">
            Προαιρετικό αρχείο .txt με το σχήμα της βάσης. Θα χρησιμοποιηθεί κατά τη δημιουργία regex patterns.
          </Text>
          <Divider />

          {schema ? (
            <HStack w="full" justify="space-between">
              <Text fontSize="sm" color="gray.300">Σχήμα βάσης διαθέσιμο</Text>
              <HStack>
                <Button leftIcon={<FiEye />} size="sm" onClick={onOpen}>
                  Προβολή
                </Button>
                <IconButton
                  aria-label="Διαγραφή σχήματος"
                  icon={<FiX />}
                  size="sm"
                  variant="ghost"
                  colorScheme="red"
                  isLoading={deleteMutation.isPending}
                  onClick={() => deleteMutation.mutate({ exerciseId })}
                />
              </HStack>
            </HStack>
          ) : null}

          <HStack w="full">
            <Input
              ref={fileInputRef}
              type="file"
              accept=".txt"
              size="sm"
              onChange={handleFileChange}
            />
            <Button
              leftIcon={<FiUpload />}
              colorScheme="brand"
              size="sm"
              isDisabled={!selectedFile}
              isLoading={uploadMutation.isPending}
              onClick={handleUpload}
            >
              Ανέβασμα
            </Button>
          </HStack>
        </VStack>
      </CardBody>

      <Modal isOpen={isOpen} onClose={onClose} size="full">
        <ModalOverlay />
        <ModalContent>
          <ModalHeader>Σχήμα Βάσης Δεδομένων</ModalHeader>
          <ModalCloseButton />
          <ModalBody overflowY="auto">
            <Box as="pre" whiteSpace="pre-wrap" fontFamily="mono" fontSize="sm">
              {schema}
            </Box>
          </ModalBody>
        </ModalContent>
      </Modal>
    </Card>
  );
}
```

- [ ] **Step 2: Verify it compiles**

```bash
cd frontend && npx tsc --noEmit -p tsconfig.json
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add frontend/src/components/Exercise/SchemaCard.tsx
git commit -m "feat: add SchemaCard component for uploading and viewing database schema"
```

---

### Task 10: Wire `SchemaCard` into `ExerciseDetailPage`

**Files:**
- Modify: `frontend/src/pages/ExerciseDetailPage.tsx`

**Interfaces:**
- Consumes: `SchemaCard` from Task 9; `exercise.databaseSchema` from Task 7's `Exercise` interface (already returned by `GET /exercises/:id` per Task 2/3 backend work).

- [ ] **Step 1: Import and render the card above `RulesCard`**

In `frontend/src/pages/ExerciseDetailPage.tsx`, add the import near the existing `RulesCard` import:

```typescript
import { SchemaCard } from '@/components/Exercise/SchemaCard';
import { RulesCard } from '@/components/Exercise/RulesCard';
```

Then, right before the existing Rules card block (around line 193-194), add:

```tsx
          {/* Schema card — hidden for project exercises */}
          {!isProject && <SchemaCard exerciseId={exercise.id} schema={exercise.databaseSchema} />}

          {/* Rules card — hidden for project exercises */}
          {!isProject && <RulesCard exerciseId={exercise.id} />}
```

- [ ] **Step 2: Verify it compiles**

```bash
cd frontend && npx tsc --noEmit -p tsconfig.json
```

Expected: no errors.

- [ ] **Step 3: Manual UI verification**

Start the backend (`npm run start:dev` in `backend/`), python-service (per its own run instructions), and frontend (`npm run dev` in `frontend/`). Open an existing non-project exercise's detail page in the browser:

1. Confirm the new "Σχήμα Βάσης Δεδομένων" card renders above "Προσθήκη κανόνων".
2. Upload a small `.txt` file → confirm the card switches to showing "Σχήμα βάσης διαθέσιμο" with "Προβολή" and delete buttons.
3. Click "Προβολή" → confirm a full-screen modal opens showing the uploaded text, and closes via the X button.
4. Click the delete (X) icon next to "Σχήμα βάσης διαθέσιμο" → confirm the card reverts to the upload-only state.
5. Re-upload a different `.txt` file → confirm the displayed schema reflects the new content (open "Προβολή" again to check).
6. On a `PROJECT`-type exercise's detail page, confirm the Schema card does not render (same as Rules).

- [ ] **Step 4: Commit**

```bash
git add frontend/src/pages/ExerciseDetailPage.tsx
git commit -m "feat: render SchemaCard on exercise detail page"
```

---

## Self-Review Notes

- Spec coverage: data model (Task 1), backend endpoints (Task 3), patterns-prompt-only injection (Task 4/6, checkpoint prompt untouched), frontend API/hooks/component/wiring (Tasks 7-10), full-height modal (Task 9), replace+delete (Task 3 endpoints, Task 9 UI) — all covered.
- No backend (NestJS) unit tests were added because no existing test files exist for `ExercisesModule` or `RulesModule` to mirror (verified: no `.spec.ts` files in either module) — manual `curl` verification is used instead, consistent with the codebase's current testing posture for this layer. Python gets real `pytest` tests because `python-service/tests/test_llm.py` already has direct precedent (`build_rules_text` tests).

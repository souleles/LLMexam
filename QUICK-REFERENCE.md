# 🚀 ExamChecker - Quick Reference Guide

## 🎯 What Was Built

A complete **LLM-powered exam grading system** for university professors with:
- **Frontend**: React + Vite + Chakra UI (refactored)
- **Backend**: NestJS + PostgreSQL + Prisma ORM
- **Python Service**: FastAPI + LangChain + OpenAI GPT-4o

---

## 📍 URLs & Access Points

| Service | URL | Description |
|---------|-----|-------------|
| **Frontend** | http://localhost:5173 | Main UI |
| **Backend API** | http://localhost:3001/api | REST API |
| **Backend Docs** | http://localhost:3001/api/docs | Swagger UI |
| **Python Service** | http://localhost:8000 | Microservice |
| **Python Docs** | http://localhost:8000/docs | FastAPI Docs |

---

## 🗺️ Frontend Routes

| Route | Page | Purpose |
|-------|------|---------|
| `/exercises` | ExercisesPage | **Table view** of all exercises |
| `/exercises/new` | NewExercisePage | **Create new exercise** (not modal) |
| `/exercises/:id` | ExerciseDetailPage | **View details**: PDF, checkpoints, chat history |
| `/student-exercises` | StudentExercisesPage | **Grade student work** with regex matching |

---

## 🎨 Key UI Changes (Refactored)

### **Before:**
- Card-based exercises list
- Modal for creating exercises
- Setup page with inline chat
- Separate pages for submissions/results

### **After:**
- ✅ **Table-based** exercises list (Title, Status, Dates, Actions)
- ✅ **Dedicated page** for new exercise (`/exercises/new`)
- ✅ **Detail page** with PDF + checkpoints + chat history
- ✅ **Chat drawer** (side panel) instead of inline
- ✅ **Unified grading page** (`/student-exercises`)

---

## 🔄 Complete Workflows

### **Workflow 1: Professor Creates Exercise**

```
1. Click "New Exercise" → /exercises/new
2. Enter title + upload PDF
3. Click "Create & Extract Checkpoints"
4. Redirected to /exercises/{id}
5. Chat drawer opens
6. Type: "Extract grading checkpoints"
7. AI streams checkpoints via SSE
8. Checkpoints appear in UI
9. Refine via chat
10. Done!
```

### **Workflow 2: Professor Grades Student**

```
1. Navigate to /student-exercises
2. Select exercise (dropdown)
3. Enter ΑΡΙΘΜΟΣ ΜΗΤΡΩΟΥ + ΟΝΟΜΑΤΕΠΩΝΥΜΟ
4. Upload student's file
5. Click "Find Results"
6. Backend runs regex checks
7. Results show: 8/10 (80%)
   ✅ Checkpoint 1: PASSED
   ✅ Checkpoint 2: PASSED
   ❌ Checkpoint 3: FAILED
8. Click "Save Results"
9. Saved to database!
```

---

## 🛠️ Starting Services

### **Terminal 1: Backend**
```powershell
cd c:\Users\nsoul\Desktop\LLM-THESIS\LLMexam\backend
npm run start:dev
```
✅ Starts on http://localhost:3001

### **Terminal 2: Python Service**
```powershell
cd c:\Users\nsoul\Desktop\LLM-THESIS\LLMexam\python-service
.\venv\Scripts\Activate.ps1
python main.py
```
✅ Starts on http://localhost:8000

### **Terminal 3: Frontend**
```powershell
cd c:\Users\nsoul\Desktop\LLM-THESIS\LLMexam\frontend
npm run dev
```
✅ Starts on http://localhost:5173

---

## 📦 What's Included

### **8 Backend Modules:**
1. **Exercises** - CRUD + file upload
2. **Checkpoints** - Pattern management
3. **Submissions** - Student files
4. **Grading** - Regex matching
5. **LLM** - SSE streaming proxy
6. **Prisma** - Database ORM
7. **Auth** - JWT (ready to use)
8. **Users** - User management

### **4 Frontend Pages:**
1. **ExercisesPage** - Table list
2. **NewExercisePage** - Create form
3. **ExerciseDetailPage** - Details + chat
4. **StudentExercisesPage** - Grade submissions

### **3 Python Endpoints:**
1. `/extract-pdf` - Extract text from PDF
2. `/generate-checkpoints` - LLM with SSE
3. `/parse-sql` - SQL token parsing

---

## 🔑 Key Features

### **✅ Deterministic Grading**
- No LLM in grading = reproducible results
- Pure regex pattern matching
- Shows exact line numbers and code snippets

### **✅ LLM-Powered Setup**
- Two-pass checkpoint extraction
- Conversation history with context trimming
- Streaming responses via SSE
- Chat interface for refinement

### **✅ Modern UI**
- Chakra UI components
- Responsive design
- Table view for exercises
- Drawer-based chat
- Real-time results
- Accordion for details

---

## 📁 Important Files

### **Configuration:**
- `backend/.env` - Database, JWT, CORS
- `python-service/.env` - OpenAI API key
- `backend/prisma/schema.prisma` - Database schema

### **Documentation:**
- `SYSTEM-STATUS.md` - Complete system overview
- `frontend/REFACTORING-COMPLETE.md` - Frontend changes
- `backend/STATUS.md` - Backend status
- `python-service/README.md` - Python setup

### **Database:**
- Migration: `backend/prisma/migrations/20260319115904_init/`
- Connection: `postgresql://postgres:nikolakis@localhost:5432/examchecker`

---

## 🎓 Technology Versions

| Tech | Version |
|------|---------|
| Node.js | Latest |
| Python | 3.11+ |
| PostgreSQL | 16 |
| React | 18 |
| NestJS | 10 |
| TypeScript | 5 |
| OpenAI | GPT-4o |

---

## 🐛 Common Issues & Fixes

### **Port Already in Use**
```powershell
# Find process using port
netstat -ano | findstr :3001

# Kill process
taskkill /PID <PID> /F
```

### **Database Connection Failed**
```powershell
# Check PostgreSQL is running
Get-Service -Name postgresql*

# Verify credentials in backend/.env
DATABASE_URL=postgresql://postgres:nikolakis@localhost:5432/examchecker
```

### **Python Service Error**
```powershell
# Activate venv
cd python-service
.\venv\Scripts\Activate.ps1

# Check OPENAI_API_KEY in .env
```

### **Frontend Build Error**
```powershell
# Clear cache and reinstall
cd frontend
rm -r node_modules
rm package-lock.json
npm install
```

---

## 📊 Database Tables

| Table | Records |
|-------|---------|
| `exercises` | Exercise PDFs |
| `checkpoints` | Grading criteria |
| `submissions` | Student files |
| `checkpoint_results` | Grading results |
| `conversations` | Chat sessions |
| `messages` | Chat messages |

---

## 🧪 Testing Commands

```powershell
# Test backend
curl http://localhost:3001/api/exercises

# Test Python service
curl http://localhost:8000/health

# Test PDF extraction
curl -X POST http://localhost:8000/extract-pdf -F "file=@test.pdf"

# Test checkpoint generation
curl -X POST http://localhost:8000/generate-checkpoints `
  -H "Content-Type: application/json" `
  -d '{"text":"Test","message":"Extract checkpoints"}' `
  --no-buffer
```

---

## 📝 Next Development Steps

1. **Authentication**
   - Implement JWT login/register
   - Add role-based access (Admin/Professor/Student)

2. **Batch Processing**
   - Upload multiple student files at once
   - Grade all students for an exercise

3. **Statistics**
   - Dashboard with charts
   - Average scores per exercise
   - Checkpoint pass rates

4. **Export**
   - Export results to CSV/Excel
   - Generate PDF reports

5. **Email Notifications**
   - Notify students of results
   - Send grading summaries to professors

---

## 🎉 You're All Set!

Your ExamChecker system is **fully functional** with:
- ✅ All three services running
- ✅ Frontend refactored with new routes
- ✅ Complete grading workflow
- ✅ LLM checkpoint extraction
- ✅ Database configured
- ✅ Documentation complete

**Happy grading!** 🚀📚

---

*For detailed information, see `SYSTEM-STATUS.md` in project root*

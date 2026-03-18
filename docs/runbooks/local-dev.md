# Runbook: Local Development Setup

Complete guide to running all three ExamChecker services locally.

## Prerequisites

- Node.js >= 20
- Python >= 3.11
- PostgreSQL >= 15 (running locally or via Docker)
- An OpenAI API key (or compatible provider)

---

## 1. Clone & Environment Files

```bash
# Copy environment templates (create these files first)
cp backend/.env.example backend/.env
cp python-service/.env.example python-service/.env
```

**`backend/.env`**
```
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/examchecker
PYTHON_SERVICE_URL=http://localhost:8000
PORT=3001
```

**`python-service/.env`**
```
OPENAI_API_KEY=sk-...
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/examchecker
PORT=8000
```

---

## 2. Database Setup

See `database-setup.md` for full schema instructions.

Quick start (if PostgreSQL is running):
```bash
createdb examchecker
cd backend && npm run db:migrate
```

---

## 3. Python Microservice (FastAPI)

```bash
cd python-service

# Create virtual environment
python3 -m venv .venv
source .venv/bin/activate

# Install dependencies
pip install -r requirements.txt

# Start development server
uvicorn main:app --reload --port 8000
```

**Verify:** `curl http://localhost:8000/health` → `{"status":"ok"}`

---

## 4. Backend (NestJS)

```bash
cd backend

# Install dependencies
npm install

# Start in watch mode
npm run start:dev
```

**Verify:** `curl http://localhost:3001/health` → `{"status":"ok"}`

---

## 5. Frontend (React + Vite)

```bash
cd frontend

# Install dependencies
npm install

# Start dev server
npm run dev
```

**Verify:** Open `http://localhost:3000` in browser.

---

## 6. Running All Services at Once (optional)

If you add a root `package.json` with `concurrently`:

```bash
npm run dev  # starts all 3 services
```

---

## Service Ports

| Service | Port | URL |
|---------|------|-----|
| Frontend | 3000 | http://localhost:3000 |
| Backend | 3001 | http://localhost:3001 |
| Python service | 8000 | http://localhost:8000 |
| PostgreSQL | 5432 | localhost:5432 |

> **macOS note:** Port 5000 is often occupied by AirPlay Receiver. Do not use it.

---

## Troubleshooting

### PostgreSQL not running
```bash
# Check status
pg_isready

# Start (Homebrew)
brew services start postgresql@15

# Start (Docker)
docker run -d -p 5432:5432 -e POSTGRES_PASSWORD=postgres postgres:15
```

### Python service can't find OpenAI key
Verify `python-service/.env` contains `OPENAI_API_KEY` and the venv is activated.

### NestJS can't reach Python service
Ensure Python service is running on port 8000 and `PYTHON_SERVICE_URL` in `backend/.env` matches.

### Frontend CORS errors
Check that `backend/.env` has the frontend origin in CORS config (or NestJS CORS is set to `*` for dev).

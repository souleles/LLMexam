# Runbook: Local Development Setup

Complete guide to running all three ExamChecker services locally.

## Prerequisites

- Node.js >= 20
- Python >= 3.11
- PostgreSQL >= 15 (running locally or via Docker)
- An OpenAI API key

---

## 1. Clone & Environment Files

```bash
cp backend/.env.example backend/.env
cp python-service/.env.example python-service/.env
```

**`backend/.env`**
```
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/examchecker
PYTHON_SERVICE_URL=http://localhost:8000
PORT=3001
JWT_SECRET=your-secret-key-here
```

**`python-service/.env`**
```
OPENAI_API_KEY=sk-...
PORT=8000
```

---

## 2. Database Setup

See `database-setup.md` for full schema instructions.

Quick start (if PostgreSQL is running):
```bash
createdb examchecker
cd backend && npx prisma migrate dev
```

---

## 3. Python Microservice (FastAPI)

```bash
cd python-service

# Create virtual environment
python3 -m venv .venv
source .venv/bin/activate   # Windows: .venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt

# Start development server
uvicorn main:app --reload --port 8000
```

**Verify:** `curl http://localhost:8000/health` → `{"status":"ok","version":"1.0.0"}`

---

## 4. Backend (NestJS)

```bash
cd backend

# Install dependencies
npm install

# Generate Prisma client
npx prisma generate

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

**Verify:** Open `http://localhost:3000` in browser. Log in with the credentials
created via `POST /auth/register`.

---

## 6. Running All Services at Once (optional)

If a root `package.json` with `concurrently` is configured:

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

---

## Troubleshooting

### PostgreSQL not running
```bash
# Check status
pg_isready

# Start (Homebrew / macOS)
brew services start postgresql@15

# Start (Docker)
docker run -d -p 5432:5432 -e POSTGRES_PASSWORD=postgres postgres:15
```

### Python service can't find OpenAI key
Verify `python-service/.env` contains `OPENAI_API_KEY` and the virtual environment
is activated before starting uvicorn.

### NestJS can't reach Python service
Ensure the Python service is running on port 8000 and `PYTHON_SERVICE_URL` in
`backend/.env` is set to `http://localhost:8000`.

### Frontend CORS errors
Check that NestJS CORS is configured to allow the frontend origin
(`http://localhost:3000` by default in dev).

### JWT errors on login
Ensure `JWT_SECRET` is set in `backend/.env` and matches what was used to sign existing tokens.

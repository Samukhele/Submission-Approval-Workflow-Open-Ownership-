# Assignment B — Submission & Approval Workflow

A full-stack application for generic request submission and approval. Applicants create and submit applications; reviewers approve, reject, or return them for changes. The backend enforces a strict status workflow with an audit trail on every transition.

## Stack

| Layer | Technology |
|---|---|
| Backend | Python 3.12, FastAPI, SQLAlchemy 2, Alembic |
| Frontend | React 18, TypeScript, Vite, TanStack Query |
| Database | PostgreSQL 16 (local Docker, **Neon**, or **Supabase**) |
| File storage | **Google Drive** (production) or local disk (development) |
| Auth | JWT (Bearer token) |
| Tests | pytest (state machine unit tests + API authorization test) |

## Quick start

### Prerequisites

- Docker & Docker Compose
- Node.js 20+ (for the frontend)

### 1. Start backend + database

```bash
docker compose up --build
```

This will:

- Start PostgreSQL on port `5432`
- Run Alembic migrations
- Seed demo users
- Start the API on http://localhost:8000

API docs: http://localhost:8000/docs

### 2. Start frontend

```bash
cd frontend
npm install
npm run dev
```

Open http://localhost:5173 — the Vite dev server proxies `/api` to the backend.

### 3. Run tests

```bash
cd backend
pip install -r requirements.txt
pytest -v
```

Or inside Docker:

```bash
docker compose exec api pytest -v
```

## Demo accounts

| Email | Password | Role |
|---|---|---|
| `applicant@demo.com` | `password123` | Applicant |
| `reviewer@demo.com` | `password123` | Reviewer |

## Workflow

```mermaid
stateDiagram-v2
    [*] --> DRAFT
    DRAFT --> SUBMITTED: submit_applicant
    SUBMITTED --> UNDER_REVIEW: start_review_reviewer
    UNDER_REVIEW --> APPROVED: approve_reviewer
    UNDER_REVIEW --> REJECTED: reject_reviewer_comment_required
    UNDER_REVIEW --> DRAFT: return_reviewer_comment_required
    DRAFT --> SUBMITTED: resubmit_applicant
    APPROVED --> [*]
    REJECTED --> [*]
```

### Rules enforced server-side

- Only the **owner** can edit or submit while status is `DRAFT`
- Applicants **cannot edit** after leaving `DRAFT` (return moves back to `DRAFT`)
- Only **reviewers** can transition out of `SUBMITTED` / `UNDER_REVIEW`
- **Reject** and **return** require a comment
- Every transition is recorded in the **audit log**

## Data model

```
users
  id, email, password_hash, role, created_at

applications
  id, owner_id, title, category, description,
  amount, requested_date, file_name, file_path,
  status, created_at, updated_at

audit_logs
  id, application_id, actor_id,
  from_status, to_status, comment, created_at
```

**Categories:** `operations`, `marketing`, `it`, `hr`

**Submit validation:** at least one of `amount` or `requested_date` is required when submitting.

**File attachments:** optional PDF, DOC, DOCX, PNG, JPG up to 10 MB. Uploaded while in `DRAFT`, stored in **Google Drive** (production) or local disk (dev). Applicants and reviewers can **view** and **download** via the API.

## Database: Neon or Supabase

Use a hosted PostgreSQL connection string instead of the local Docker database.

1. Create a project on [Neon](https://neon.tech) or [Supabase](https://supabase.com)
2. Copy the **PostgreSQL connection string** (enable SSL)
3. Set in `backend/.env`:

```bash
# Neon
DATABASE_URL=postgresql://USER:PASSWORD@ep-xxxx.neon.tech/approval_workflow?sslmode=require

# Supabase
DATABASE_URL=postgresql://postgres:PASSWORD@db.xxxxx.supabase.co:5432/postgres?sslmode=require
```

4. Run migrations against the remote database:

```bash
cd backend
pip install -r requirements.txt
alembic upgrade head
python -m app.seed
```

5. Start only the API (skip local Postgres in docker-compose) or run `uvicorn app.main:app --reload` locally.

## Google Drive file storage

Attachments are stored in Google Drive using a **service account**. The API streams files to applicants and reviewers — access is still enforced by your app auth.

### Setup

1. Open [Google Cloud Console](https://console.cloud.google.com/)
2. Create a project → enable **Google Drive API**
3. Create a **Service Account** → download JSON key
4. In Google Drive, create a folder (e.g. `ApprovalWorkflow-Attachments`)
5. **Share the folder** with the service account email (`...@...iam.gserviceaccount.com`) as **Editor**
6. Copy the folder ID from the URL: `https://drive.google.com/drive/folders/FOLDER_ID`
7. Configure `backend/.env`:

```bash
STORAGE_BACKEND=google_drive
GOOGLE_DRIVE_CREDENTIALS_FILE=./secrets/google-service-account.json
# or paste JSON directly:
# GOOGLE_DRIVE_CREDENTIALS_JSON={"type":"service_account",...}
GOOGLE_DRIVE_FOLDER_ID=your-folder-id
```

8. Rebuild and restart the API:

```bash
docker compose up --build -d api
```

### Local development without Google Drive

Keep the default:

```bash
STORAGE_BACKEND=local
UPLOAD_DIR=uploads
```

Files are saved under `uploads/{application_id}/`.

## Deploy to Render

Production uses three Render resources: **PostgreSQL**, a **Web Service** (FastAPI API), and a **Static Site** (React frontend). File attachments use **Google Drive** (`STORAGE_BACKEND=google_drive`).

### 1. Push to GitHub

```bash
git init
git add .
git commit -m "Initial commit"
git remote add origin https://github.com/YOUR_USER/approval-workflow.git
git push -u origin main
```

In Render, connect your GitHub account and grant access to the repo.

### 2. One-click blueprint (recommended)

The repo includes [`render.yaml`](render.yaml). In Render:

1. **New +** → **Blueprint** → select the repo
2. Set these secrets when prompted:
   - `CORS_ORIGINS` — your frontend URL (set after first deploy, e.g. `https://approval-workflow.onrender.com`)
   - `VITE_API_URL` — your API URL (e.g. `https://approval-workflow-api.onrender.com`)
   - `GOOGLE_DRIVE_CREDENTIALS_JSON` — service account JSON (single line)
   - `GOOGLE_DRIVE_FOLDER_ID` — shared Drive folder ID
3. Apply the blueprint

### 3. Manual setup (alternative)

| Resource | Type | Root dir | Notes |
|---|---|---|---|
| `approval-workflow-db` | PostgreSQL | — | Free plan; copy **Internal** URL |
| `approval-workflow-api` | Web Service (Docker) | `backend` | Health check: `/health` |
| `approval-workflow` | Static Site | `frontend` | Build: `npm install && npm run build`, publish: `dist` |

**API environment variables:**

| Key | Value |
|---|---|
| `DATABASE_URL` | Render Postgres internal URL |
| `SECRET_KEY` | random secret (`openssl rand -hex 32`) |
| `CORS_ORIGINS` | frontend URL (no trailing slash) |
| `STORAGE_BACKEND` | `google_drive` |
| `GOOGLE_DRIVE_CREDENTIALS_JSON` | service account JSON |
| `GOOGLE_DRIVE_FOLDER_ID` | Drive folder ID |

**Frontend environment variable (set before build):**

| Key | Value |
|---|---|
| `VITE_API_URL` | API URL (no trailing slash) |

Deploy the **API first**, then the **static site**, then update `CORS_ORIGINS` on the API and redeploy.

### 4. Verify

- `GET https://YOUR-API.onrender.com/health` → `{"status":"ok"}`
- Log in with `reviewer@demo.com` / `password123`
- Free tier services sleep after ~15 min idle; first request may take 30–60s

See [`DEPLOY_RENDER.md`](DEPLOY_RENDER.md) for a full step-by-step checklist.

## API overview

Base URL: `/api/v1`

| Method | Endpoint | Access |
|---|---|---|
| POST | `/auth/login` | Public |
| GET | `/auth/me` | Authenticated |
| GET | `/applications` | Applicant (own) / Reviewer (all, filterable) |
| POST | `/applications` | Applicant |
| GET/PATCH | `/applications/{id}` | Owner (PATCH: DRAFT only) / Reviewer (read) |
| POST | `/applications/{id}/submit` | Owner |
| POST | `/applications/{id}/transition` | Reviewer |
| POST/GET | `/applications/{id}/file` | Owner (upload) / Owner or Reviewer (view & download) |
| GET | `/applications/{id}/audit` | Owner or Reviewer |

Errors return structured JSON: `{ "error", "code", "details" }`.

## Project structure

```
backend/          FastAPI app, models, state machine, tests
frontend/         React SPA
docker-compose.yml
uploads/          Local file storage when STORAGE_BACKEND=local
secrets/          Google service account JSON (not committed)
```

## Design decisions & trade-offs

### State machine as pure logic

Transition rules live in `app/services/state_machine.py` with **no database imports**. This keeps unit tests fast and guarantees the same rules apply everywhere. HTTP layers map errors to `403` (forbidden role/owner) or `409` (illegal transition).

### Return → DRAFT (not a separate RETURNED status)

Returning for changes moves the application back to `DRAFT` so edit rules stay simple: only `DRAFT` is editable. In production I would add a `RETURNED` status with a revision counter for clearer reporting.

### JWT authentication

Stateless JWT keeps the SPA simple. Production would use short-lived access tokens, refresh tokens, and httpOnly cookies.

### Google Drive file storage

Attachments are uploaded to a shared Google Drive folder via a service account. The database stores the Drive file ID and mime type; downloads are proxied through the API so JWT authorization still applies. Local disk remains available for development via `STORAGE_BACKEND=local`.

### No pagination

Reviewer queue supports status filtering but not pagination/search — cut to keep the core workflow solid within scope.

### Historical integrity

Audit logs store `from_status` and `to_status` at transition time. Application rows reflect current state only; the audit trail is the source of truth for history.

## Tests

- **16 state machine unit tests** — legal transitions, illegal transitions, comment requirements, terminal states
- **1 API integration test** — applicant receives `403` when attempting to approve; reviewer succeeds and audit log is written

## Use of AI tools

This project was built with assistance from **Cursor AI (Claude)**. AI was used for:

- Initial project scaffolding and boilerplate
- State machine and test case drafting
- React component structure and styling

All code was reviewed and adjusted manually. The state machine rules, authorization model, and workflow behavior were verified against the assignment spec before submission.

## What I would add with more time

- Pagination and search on the reviewer queue
- Email or in-app notifications on status change
- Explicit `RETURNED` status with revision history UI
- Refresh tokens and rate limiting
- CI pipeline running migrations + pytest on every push

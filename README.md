# Assignment B — Submission & Approval Workflow

A full-stack application for generic request submission and approval. Applicants create and submit applications; reviewers approve, reject, or return them for changes. The backend enforces a strict status workflow with an audit trail on every transition.

## Stack

| Layer | Technology |
|---|---|
| Backend | Python 3.12, FastAPI, SQLAlchemy 2, Alembic |
| Frontend | React 18, TypeScript, Vite, TanStack Query |
| Database | PostgreSQL 16 (local Docker, Neon, Supabase, or Render Postgres) |
| File storage | **Azure Blob Storage** (production) or local disk (development) |
| Auth | JWT (Bearer token) |
| Tests | pytest (state machine + API integration tests) |
| CI | GitHub Actions (pytest + frontend build) |

## Features

### Applicant
- Dashboard listing own applications
- Create drafts with title, category, description, amount, date, and optional attachment
- Submit for review (requires amount or requested date)
- View status pipeline, status history, and reviewer comments on returned applications
- View and download attachments

### Reviewer
- **Dashboard** with stat cards (Submitted, Under Review, Approved, Rejected)
- **Sidebar navigation** by status: Dashboard, Submitted, Under review, Approved, Rejected
- **Queue filtering** by status and category (IT, Marketing, Finance, HR, Operations)
- Application detail view with **Details** and **Attachment** side by side, **Reviewer actions** below
- Full-screen **Extend editor** for review comments
- Approve, reject, return for changes, or put under review
- View and download attachments

### UI
- ZIG-inspired design system (orange brand, dark/light theme toggle)
- Sidebar highlights the active section in orange (including on application detail pages)

## Quick start

### Prerequisites

- Docker & Docker Compose
- Node.js 20+ (for the frontend)

### 1. Configure environment

```bash
cp backend/.env.example backend/.env
```

For local development, use local file storage (default in `.env.example` comments):

```bash
STORAGE_BACKEND=local
UPLOAD_DIR=uploads
```

Set `DATABASE_URL` if using a remote Postgres instance (Neon, Supabase, Render).

### 2. Start backend + database

```bash
docker compose up --build
```

This will:

- Start PostgreSQL on port `5432`
- Run Alembic migrations
- Seed demo users
- Start the API on http://localhost:8000

API docs: http://localhost:8000/docs

Health check: http://localhost:8000/health

### 3. Start frontend

```bash
cd frontend
npm install
npm run dev
```

Open http://localhost:5173 — the Vite dev server proxies `/api` to the backend.

### 4. Run tests

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
  amount, requested_date, file_name, file_path, file_mime_type,
  status, created_at, updated_at

audit_logs
  id, application_id, actor_id,
  from_status, to_status, comment, created_at
```

**Categories:** `it`, `marketing`, `finance`, `hr`, `operations`

**Submit validation:** at least one of `amount` or `requested_date` is required when submitting.

**File attachments:** optional PDF, DOC, DOCX, PNG, JPG up to 10 MB. Uploaded while in `DRAFT`. Applicants and reviewers can **view** and **download** via the API.

## File storage

The API uses a pluggable storage backend (`STORAGE_BACKEND`):

| Backend | Use case |
|---|---|
| `local` | Local development — files in `uploads/{application_id}/` |
| `azure_blob` | **Production (Render)** — Azure Blob Storage via SAS token |
| `google_drive` | Optional — requires Google Workspace Shared Drive |

### Azure Blob Storage (production)

Attachments are stored in Azure Blob Storage. The database stores the blob path; downloads are proxied through the API so JWT authorization still applies.

**Blob path format:** `applications/{application_id}/{filename}`

Configure `backend/.env`:

```bash
STORAGE_BACKEND=azure_blob
AZURE_BLOB_ACCOUNT=yourstorageaccount
AZURE_BLOB_CONTAINER=approval-uploads
AZURE_BLOB_SAS_TOKEN=sp=racwdl&st=...&se=...&sig=...
```

| Variable | Description |
|---|---|
| `AZURE_BLOB_ACCOUNT` | Storage account name (not the full URL) |
| `AZURE_BLOB_CONTAINER` | Container name |
| `AZURE_BLOB_SAS_TOKEN` | SAS token (`?` prefix is stripped automatically) |

**Azure setup:**
1. Create a storage account and container in [Azure Portal](https://portal.azure.com)
2. Generate a container SAS with **Read**, **Write**, **Delete**, **List** permissions
3. Set the three env vars above
4. Verify: `GET /health` → `"storage_backend": "azure_blob", "azure_blob_configured": true`

### Local development

```bash
STORAGE_BACKEND=local
UPLOAD_DIR=uploads
```

`docker-compose.yml` mounts `./uploads` into the API container at `/app/uploads`.

## Database: Neon, Supabase, or Render Postgres

Use a hosted PostgreSQL connection string instead of the local Docker database.

1. Create a project on [Neon](https://neon.tech), [Supabase](https://supabase.com), or [Render](https://render.com)
2. Copy the **PostgreSQL connection string** (enable SSL for cloud providers)
3. Set in `backend/.env`:

```bash
DATABASE_URL=postgresql://USER:PASSWORD@host:5432/approval_workflow?sslmode=require
```

4. Run migrations:

```bash
cd backend
pip install -r requirements.txt
alembic upgrade head
python -m app.seed
```

5. Start the API (`docker compose up api` or `uvicorn app.main:app --reload`)

## Deploy to Render

Production uses three Render resources: **PostgreSQL**, a **Web Service** (FastAPI API via Docker), and a **Static Site** (React frontend). File attachments use **Azure Blob Storage**.

See [`DEPLOY_RENDER.md`](DEPLOY_RENDER.md) for the full step-by-step checklist.

### One-click blueprint

The repo includes [`render.yaml`](render.yaml). In Render:

1. **New +** → **Blueprint** → select the repo
2. Set secrets when prompted:
   - `CORS_ORIGINS` — frontend URL (e.g. `https://approval-workflow.onrender.com`)
   - `VITE_API_URL` — API URL (e.g. `https://approval-workflow-api.onrender.com`)
   - `AZURE_BLOB_ACCOUNT`, `AZURE_BLOB_CONTAINER`, `AZURE_BLOB_SAS_TOKEN`
3. Apply the blueprint

### Manual setup

| Resource | Type | Root dir | Notes |
|---|---|---|---|
| `approval-workflow-db` | PostgreSQL | — | Copy **Internal** URL |
| `approval-workflow-api` | Web Service (Docker) | `backend` | Health check: `/health` |
| `approval-workflow` | Static Site | `frontend` | Build: `npm install && npm run build`, publish: `dist` |

**API environment variables:**

| Key | Value |
|---|---|
| `DATABASE_URL` | Render Postgres internal URL |
| `SECRET_KEY` | random secret |
| `CORS_ORIGINS` | frontend URL (no trailing slash) |
| `STORAGE_BACKEND` | `azure_blob` |
| `AZURE_BLOB_ACCOUNT` | storage account name |
| `AZURE_BLOB_CONTAINER` | container name |
| `AZURE_BLOB_SAS_TOKEN` | SAS token (mark as secret) |

**Frontend environment variable (set before build):**

| Key | Value |
|---|---|
| `VITE_API_URL` | API URL (no trailing slash) |

Deploy the **API first**, then the **static site**, then update `CORS_ORIGINS` on the API and redeploy.

### Verify

```bash
curl https://YOUR-API.onrender.com/health
```

Expected:

```json
{
  "status": "ok",
  "storage_backend": "azure_blob",
  "azure_blob_configured": true
}
```

Free tier services sleep after ~15 min idle; first request may take 30–60s.

## API overview

Base URL: `/api/v1`

| Method | Endpoint | Access |
|---|---|---|
| POST | `/auth/login` | Public |
| GET | `/auth/me` | Authenticated |
| GET | `/applications` | Applicant (own) / Reviewer (all); query: `status`, `category` |
| POST | `/applications` | Applicant |
| GET/PATCH | `/applications/{id}` | Owner (PATCH: DRAFT only) / Reviewer (read) |
| POST | `/applications/{id}/submit` | Owner |
| POST | `/applications/{id}/transition` | Reviewer |
| POST/GET | `/applications/{id}/file` | Owner (upload) / Owner or Reviewer (view & download) |
| GET | `/applications/{id}/audit` | Owner or Reviewer |
| GET | `/health` | Public |

Errors return structured JSON: `{ "error", "code", "details" }`.

## Project structure

```
backend/
  app/              FastAPI app, models, state machine, storage backends
  alembic/          Database migrations
  Dockerfile        Image recipe for the API (used by Render)
  .env.example      Environment variable template
frontend/
  src/              React SPA (pages, components, styles)
docker-compose.yml  Local dev: Postgres + API (uses backend/Dockerfile)
render.yaml         Render blueprint (DB + API + frontend)
uploads/            Local file storage when STORAGE_BACKEND=local
DEPLOY_RENDER.md    Render deployment checklist
.github/workflows/  CI (pytest + frontend build)
```

**Dockerfile vs docker-compose.yml:** The `Dockerfile` defines how to build the API image. `docker-compose.yml` orchestrates multiple containers (Postgres + API) for local development. Render uses only the `Dockerfile`.

## Design decisions & trade-offs

### State machine as pure logic

Transition rules live in `app/services/state_machine.py` with **no database imports**. This keeps unit tests fast and guarantees the same rules apply everywhere. HTTP layers map errors to `403` (forbidden role/owner) or `409` (illegal transition).

### Return → DRAFT (not a separate RETURNED status)

Returning for changes moves the application back to `DRAFT` so edit rules stay simple: only `DRAFT` is editable. In production I would add a `RETURNED` status with a revision counter for clearer reporting.

### JWT authentication

Stateless JWT keeps the SPA simple. Production would use short-lived access tokens, refresh tokens, and httpOnly cookies.

### Pluggable file storage

`app/services/storage.py` abstracts storage behind a common interface (`upload`, `download`, `delete`). Production uses **Azure Blob Storage** (durable across deploys/restarts). Local disk is used for development. Google Drive remains available but requires a Google Workspace Shared Drive.

### No pagination

Reviewer queue supports status and category filtering but not pagination/search — cut to keep the core workflow solid within scope.

### Historical integrity

Audit logs store `from_status` and `to_status` at transition time. Application rows reflect current state only; the audit trail is the source of truth for history.

## Tests

- **19 state machine unit tests** — legal transitions, illegal transitions, comment requirements, terminal states
- **3 API integration tests** — authorization and workflow behavior

CI runs on every push/PR to `main` (`.github/workflows/ci.yml`).

## Use of AI tools

This project was built with assistance from **Cursor AI**. AI was used for:

- Initial project scaffolding and boilerplate
- State machine and test case drafting
- React component structure, ZIG-inspired styling, and reviewer UX
- Azure Blob Storage integration and Render deployment prep

All code was reviewed and adjusted manually. The state machine rules, authorization model, and workflow behavior were verified against the assignment spec before submission.

## What I would add with more time

- Pagination and search on the reviewer queue
- Email or in-app notifications on status change
- Explicit `RETURNED` status with revision history UI
- Refresh tokens and rate limiting
- Azure SAS token rotation and managed identity (instead of long-lived SAS)

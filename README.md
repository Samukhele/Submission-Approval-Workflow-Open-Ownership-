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
- **Dashboard** listing own applications with **filters** by status and category
- **Status filters:** Draft, Submitted, Under review, Returned for changes, Approved, Rejected
- **Category filters:** IT, Marketing, Finance, HR, Operations
- Create drafts with title, category, description, amount, date, and optional attachment
- **Save draft** or **Submit for review** from the new-application form (requires amount or requested date to submit)
- **Returned applications:** single **Revise & Submit** action to open the draft, read reviewer feedback, edit, and resubmit
- **Rejected applications:** **Track status** only (read-only; no revise flow)
- View **status pipeline** (including a blinking **Returned** step when applicable), audit trail, and reviewer comments
- Audit trail shows **Returned for changes** (not raw `DRAFT`) on return transitions
- View and download attachments

### Reviewer
- **Dashboard** with stat cards (Submitted, Under Review, Returned, Approved, Rejected)
- **Sidebar navigation** by status: Dashboard, Submitted, Under review, **Returned**, Approved, Rejected
- **Queue filtering** by status and category
- Application detail view with **Details** and **Attachment** side by side, **Reviewer actions** below
- Approve, reject, or **return for changes** from **Submitted** or **Under review** (comment required for reject/return)
- Put applications under review, or approve/reject directly from the submitted queue
- View and download attachments

### UI
- Custom design system (orange brand, dark/light theme toggle)
- Sidebar highlights the active section in orange (including on application detail pages)
- Status badges with distinct styling per state (returned = dark grey)
- Application pipeline with animated active step (under review / returned)

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

Set `DATABASE_URL` in `backend/.env` to your Postgres instance (local Docker, Neon, Supabase, or Render). The API container loads this file via `docker-compose.yml`.

For Render Postgres, include SSL:

```bash
DATABASE_URL=postgresql://USER:PASSWORD@host:5432/dbname?sslmode=require
```

### 2. Start backend

```bash
docker compose up --build
```

This will:

- Start the API on http://localhost:8000 (using `backend/.env` for database and storage config)
- Run Alembic migrations on startup
- Seed demo users
- Optionally start a local Postgres container on port `5432` (use its URL in `.env` if you prefer local DB over a hosted one)

API docs: http://localhost:8000/docs

Health check: http://localhost:8000/health

> **Note:** After changing backend code, rebuild the API image: `docker compose up --build`. The API container does not mount source code for hot reload.

### 3. Start frontend

```bash
cd frontend
npm install
npm run dev
```

Open http://localhost:5173 — the Vite dev server proxies `/api` to the backend.

**Frontend scripts:**

| Command | Description |
|---|---|
| `npm run dev` | Dev server at http://localhost:5173 |
| `npm run build` | Production build → `frontend/dist/` |
| `npm run preview` | Preview production build locally |

**Frontend environment (production / Render only):** set before `npm run build`:

```bash
VITE_API_URL=https://your-api.onrender.com
```

Local development does not need this — Vite proxies API requests to `http://localhost:8000`.

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

## Frontend routes

| Route | Role | Description |
|---|---|---|
| `/` | Applicant | Dashboard with status/category filters |
| `/applications/new` | Applicant | Create draft or submit for review |
| `/applications/:id` | Both | Detail view, pipeline, audit trail, role-specific actions |
| `/review` | Reviewer | Dashboard with stat cards |
| `/review/queue` | Reviewer | Filtered queue (`?status=` and `?category=` query params) |

Login is role-based: applicants land on the dashboard; reviewers land on the review dashboard.

## Workflow

Stored status in the database uses: `DRAFT`, `SUBMITTED`, `UNDER_REVIEW`, `APPROVED`, `REJECTED`.

**Returned for changes** is a **display status** only: the DB row is `DRAFT`, but the API and UI derive `RETURNED` from the audit trail (return transition from `SUBMITTED` or `UNDER_REVIEW` with a comment). This keeps edit rules simple while giving applicants and reviewers a clear “returned” state in lists, filters, and the pipeline.

```mermaid
stateDiagram-v2
    [*] --> DRAFT
    DRAFT --> SUBMITTED: submit_applicant
    SUBMITTED --> UNDER_REVIEW: start_review_reviewer
    SUBMITTED --> APPROVED: approve_reviewer
    SUBMITTED --> REJECTED: reject_reviewer_comment_required
    SUBMITTED --> DRAFT: return_reviewer_comment_required
    UNDER_REVIEW --> APPROVED: approve_reviewer
    UNDER_REVIEW --> REJECTED: reject_reviewer_comment_required
    UNDER_REVIEW --> DRAFT: return_reviewer_comment_required
    DRAFT --> SUBMITTED: resubmit_applicant
    APPROVED --> [*]
    REJECTED --> [*]
```

### Rules enforced server-side

- Only the **owner** can edit or submit while status is `DRAFT`
- Applicants **cannot edit** after leaving `DRAFT` (return moves back to `DRAFT` for editing)
- Only **reviewers** can transition out of `SUBMITTED` / `UNDER_REVIEW`
- **Reject** and **return** require a comment
- Illegal transitions return **409**; forbidden role/owner actions return **403**
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

**API response fields (applications):** `status` (stored enum) and `display_status` (UI status, may be `RETURNED`).

**API response fields (audit):** `to_status` (stored enum) and `display_to_status` (shows `RETURNED` on return transitions).

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

5. Start the API (`docker compose up --build` or `uvicorn app.main:app --reload`)

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
| POST | `/applications/{id}/transition` | Reviewer (`action`: `start_review`, `approve`, `reject`, `return`) |
| POST/GET | `/applications/{id}/file` | Owner (upload) / Owner or Reviewer (view & download) |
| GET | `/applications/{id}/audit` | Owner or Reviewer |
| GET | `/health` | Public |

**List filters:** `status` accepts stored statuses plus `RETURNED` (display filter). `category` accepts `it`, `marketing`, `finance`, `hr`, `operations`.

Errors return structured JSON: `{ "error", "code", "details" }`.

## Project structure

```
backend/
  app/
    main.py           FastAPI entrypoint
    routers/          auth, applications
    services/         state machine, applications, audit, storage
    models/           SQLAlchemy models
    schemas/          Pydantic request/response models
  alembic/            Database migrations
  tests/              State machine + API tests
  Dockerfile          API image (used by Render)
  .env.example        Environment variable template

frontend/
  src/
    pages/            ApplicantDashboard, ApplicationDetail, ReviewerQueue, etc.
    components/       StatusPipeline, AuditTimeline, StatusBadge, layout/Sidebar
    api/client.ts     API client (TanStack Query)
    styles/globals.css
  vite.config.ts      Dev proxy to backend

docker-compose.yml    Local dev: optional Postgres + API (uses backend/.env)
render.yaml           Render blueprint (DB + API + frontend)
uploads/              Local file storage when STORAGE_BACKEND=local
DEPLOY_RENDER.md      Render deployment checklist
.github/workflows/    CI (pytest + frontend build)
```

**Dockerfile vs docker-compose.yml:** The `Dockerfile` defines how to build the API image. `docker-compose.yml` orchestrates containers for local development. Render uses only the `Dockerfile`.

## Design decisions & trade-offs

### State machine as pure logic

Transition rules live in `app/services/state_machine.py` with **no database imports**. This keeps unit tests fast and guarantees the same rules apply everywhere. HTTP layers map errors to `403` (forbidden role/owner) or `409` (illegal transition).

### Return → DRAFT with display status RETURNED

Returning for changes stores `DRAFT` in the database so edit/submit rules stay unchanged. The API computes `display_status: RETURNED` from the audit trail so dashboards, filters, sidebar navigation, and the status pipeline can treat “returned” as a first-class UI state without a separate DB enum or migration.

### JWT authentication

Stateless JWT keeps the SPA simple. Production would use short-lived access tokens, refresh tokens, and httpOnly cookies.

### Pluggable file storage

`app/services/storage.py` abstracts storage behind a common interface (`upload`, `download`, `delete`). Production uses **Azure Blob Storage** (durable across deploys/restarts). Local disk is used for development.

### Filtering without pagination

Both applicant and reviewer lists support **status** and **category** filters via query params. Pagination and full-text search were cut to keep scope focused on the core workflow.

### Historical integrity

Audit logs store `from_status` and `to_status` at transition time. The API adds `display_to_status` so return events read as “Returned for changes” in the UI. Application rows reflect current stored state; the audit trail is the source of truth for history.

## Tests

- **20 state machine unit tests** — legal transitions (including return from submitted/under review), illegal transitions, comment requirements, terminal states
- **4 API integration tests** — authorization, audit trail, return-from-submitted workflow

CI runs on every push/PR to `main` (`.github/workflows/ci.yml`).

## Use of AI tools

This project was built with assistance from **Cursor AI**. AI was used for:

- Initial project scaffolding and boilerplate
- State machine and test case drafting
- React component structure, UI styling, and reviewer/applicant UX
- Return workflow, display status, filters, and pipeline UX
- Azure Blob Storage integration and Render deployment prep

All code was reviewed and adjusted manually. The state machine rules, authorization model, and workflow behavior were verified against the assignment spec before submission.

## What I would add with more time

- Pagination and search on application lists
- Email or in-app notifications on status change
- Refresh tokens and rate limiting
- Azure SAS token rotation and managed identity (instead of long-lived SAS)
- Backend source volume mount or dev reload in Docker for faster local iteration

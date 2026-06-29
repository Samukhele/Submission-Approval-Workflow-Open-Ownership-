# Render deployment checklist

Follow these steps in order after the code changes for Render are committed.

## Monorepo layout (frontend + backend)

This repo has two app folders at the root:

```
/
├── backend/     → Render Web Service (Docker)
├── frontend/    → Render Static Site
├── render.yaml  → optional one-click blueprint
└── docker-compose.yml  → local dev only
```

Render treats each folder as a **separate service** from the **same GitHub repo**. Set **Root Directory** so Render only builds/deploys the folder you need.

| Service | Root Directory | Runtime |
|---------|----------------|---------|
| API (backend) | `backend` | Docker |
| Frontend | `frontend` | Static Site |

Only changes inside that folder trigger auto-deploy for that service (when root directory is set).

## Prerequisites

- GitHub account
- Render account (https://render.com)
- Google Drive service account configured (see [README.md](README.md#google-drive-file-storage))

## Step 1 — Push to GitHub

```bash
cd "takeHome Assement"
git init
git add .
git commit -m "Prepare for Render deployment"
git branch -M main
git remote add origin https://github.com/YOUR_USER/approval-workflow.git
git push -u origin main
```

In Render: **Account Settings → Git Provider → Connect GitHub** and authorize the repository.

## Step 2 — Option A: Blueprint (recommended)

1. Render Dashboard → **New +** → **Blueprint**
2. Select your GitHub repo
3. Render reads [`render.yaml`](render.yaml) and creates:
   - PostgreSQL database `approval-workflow-db`
   - Web Service `approval-workflow-api` (Docker, `backend/`)
   - Static Site `approval-workflow` (`frontend/`)
4. When prompted, enter:
   - `GOOGLE_DRIVE_CREDENTIALS_JSON` — paste full service account JSON
   - `GOOGLE_DRIVE_FOLDER_ID` — your shared folder ID
   - `VITE_API_URL` — leave blank on first pass; set after API deploys (see Step 4)
   - `CORS_ORIGINS` — leave blank on first pass; set after frontend deploys (see Step 5)
5. Click **Apply**

## Step 2 — Option B: Manual services

### PostgreSQL

1. **New +** → **PostgreSQL**
2. Name: `approval-workflow-db`
3. Plan: Free
4. Copy the **Internal Database URL**

### Backend API (your current screen)

1. **New +** → **Web Service** → select repo `Samukhele/Submission-Approval-Workflow-Open-Ownership-`
2. Settings:

| Field | Value |
|-------|-------|
| Name | `approval-workflow-api` (or keep yours) |
| **Root Directory** | **`backend`** ← required for monorepo |
| Runtime | **Docker** |
| Branch | `main` |
| Health Check Path | `/health` |

3. Do **not** set a custom build/start command — Docker uses [`backend/Dockerfile`](backend/Dockerfile), which runs migrations, seed, and uvicorn on `$PORT`.

4. **Environment variables** (Environment tab — never commit these):

| Key | Value |
|-----|-------|
| `DATABASE_URL` | Render Postgres **Internal** URL |
| `SECRET_KEY` | Generate in Render or `openssl rand -hex 32` |
| `CORS_ORIGINS` | Frontend URL after deploy (e.g. `https://your-app.onrender.com`) |
| `STORAGE_BACKEND` | `google_drive` or `local` |
| `GOOGLE_DRIVE_CREDENTIALS_JSON` | Service account JSON (if using Drive) |
| `GOOGLE_DRIVE_FOLDER_ID` | Drive folder ID (if using Drive) |

5. Deploy → note API URL: `https://YOUR-SERVICE.onrender.com`

### Frontend

1. **New +** → **Static Site** → same repo
2. Name: `approval-workflow`
3. Root Directory: `frontend`
4. Build Command: `npm install && npm run build`
5. Publish Directory: `dist`
6. Environment:

```
VITE_API_URL=https://approval-workflow-api.onrender.com
```

7. Deploy and note URL: `https://approval-workflow.onrender.com`

## Step 3 — Verify API health

```bash
curl https://approval-workflow-api.onrender.com/health
```

Expected: `{"status":"ok"}`

First request on free tier may take 30–60 seconds if the service was sleeping.

## Step 4 — Set frontend API URL (blueprint only)

If you used the blueprint and left `VITE_API_URL` empty:

1. Open the **approval-workflow** static site → **Environment**
2. Set `VITE_API_URL` to your API URL (no trailing slash)
3. **Manual Deploy** to rebuild

## Step 5 — Set CORS on API

1. Open **approval-workflow-api** → **Environment**
2. Set `CORS_ORIGINS` to your frontend URL (no trailing slash), e.g.:
   ```
   https://approval-workflow.onrender.com
   ```
3. **Manual Deploy**

## Step 6 — Smoke test

| Test | Expected |
|---|---|
| Open frontend URL | Login page loads |
| Login `reviewer@demo.com` / `password123` | Redirects to review queue |
| Filter SUBMITTED | List loads (may be empty) |
| Login `applicant@demo.com` | Create draft with attachment |
| Submit application | Reviewer sees it in queue |
| Reviewer opens application | Attachment View/Download works |

## Troubleshooting

| Issue | Fix |
|---|---|
| CORS error in browser | Set `CORS_ORIGINS` on API to exact frontend URL; redeploy API |
| "Unable to reach the API" | Check `VITE_API_URL` on static site; rebuild frontend |
| Login works locally but not on Render | Frontend must be rebuilt after changing `VITE_API_URL` |
| File upload fails | Verify Google Drive folder is shared with service account email |
| 502 on first request | Free tier cold start — wait and retry |
| Database connection error | Use **Internal** database URL on the API service |

## CI/CD

### What Render does automatically (CD)

Once GitHub is connected, Render **auto-deploys** on every push to `main`:

- Push changes under `backend/` → API service rebuilds
- Push changes under `frontend/` → Static site rebuilds

No separate deploy pipeline is required for basic CD. In the service **Settings → Build & Deploy**, confirm **Auto-Deploy** is enabled.

### GitHub Actions (CI)

This repo includes [`.github/workflows/ci.yml`](.github/workflows/ci.yml):

- **Backend job:** Postgres service container → `alembic upgrade head` → `pytest`
- **Frontend job:** `npm ci` → `npm run build`

Runs on every push and pull request to `main`. Fix failing tests before merging — Render will still deploy if auto-deploy is on, so CI acts as a quality gate.

### Optional: deploy only after CI passes

Render does not wait for GitHub Actions by default. To gate deploys:

1. Disable auto-deploy on the Render service
2. Add a deploy hook URL from Render to GitHub Actions (run only on `main` after tests pass)

Or use **Render Blueprint** ([`render.yaml`](render.yaml)) to provision DB + API + frontend together.

## Troubleshooting

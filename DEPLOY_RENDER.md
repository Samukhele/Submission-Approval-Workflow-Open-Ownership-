# Render deployment checklist

Follow these steps in order after the code changes for Render are committed.

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

### Backend API

1. **New +** → **Web Service** → select repo
2. Name: `approval-workflow-api`
3. Root Directory: `backend`
4. Runtime: **Docker**
5. Health Check Path: `/health`
6. Environment variables:

```
DATABASE_URL=<internal postgres url>
SECRET_KEY=<random hex string>
STORAGE_BACKEND=google_drive
GOOGLE_DRIVE_CREDENTIALS_JSON=<json>
GOOGLE_DRIVE_FOLDER_ID=<folder id>
CORS_ORIGINS=https://approval-workflow.onrender.com
```

7. Deploy and note URL: `https://approval-workflow-api.onrender.com`

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

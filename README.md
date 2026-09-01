# AI-Path Assist — Full-Stack Build

A complete, working full-stack implementation of the AI-Path Assist clinical pathology
platform from your project proposal: Next.js frontend + Node/Express backend + SQLite
database + a real image-analysis pipeline.

```
aipath-fullstack/
├── frontend/     Next.js 14 (App Router) + TypeScript + Tailwind
└── backend/      Node/Express + node:sqlite + Python CV analysis engine
```

## Quick start

You need three terminals (Postgres+Redis, backend, frontend). Requires **Node.js ≥
18**, **Docker** (for Postgres/Redis), and **Python 3.10+** with `numpy`, `Pillow`,
`scipy`.

```bash
# Terminal 1 — Postgres + Redis
cd backend
docker compose up -d          # starts Postgres 16 + Redis 7
cp .env.example .env           # adjust DATABASE_URL/REDIS_URL if you changed ports

# Terminal 2 — backend (API + BullMQ worker, in one process by default)
cd backend
npm install
pip install -r ai/requirements.txt --break-system-packages   # or use a venv
npm run migrate     # creates tables in Postgres (idempotent)
npm run seed         # creates demo users + sample patient cases
npm run dev           # http://localhost:4000

# Terminal 3 — frontend
cd frontend
npm install
npm run dev             # http://localhost:3000
```

Frontend reads the backend URL from `frontend/.env.local`:
```
NEXT_PUBLIC_API_URL=http://localhost:4000
```

### Scaling the analysis pipeline

The API server starts an in-process BullMQ worker by default so `npm run dev` is a
complete single-command demo. For real horizontal scaling, set
`RUN_WORKER_IN_PROCESS=false` in `backend/.env` and run one or more dedicated worker
processes instead — they all pull from the same Redis queue:
```bash
npm run worker          # or npm run worker:dev for auto-reload
```
Set `WORKER_CONCURRENCY` (default `2`) to control how many slides each worker
processes in parallel — extra uploads simply queue in Redis until a slot frees up.
You can verify this yourself: upload 4+ slides at once and watch `/api/queue/active`
show exactly `WORKER_CONCURRENCY` jobs as `"active"` and the rest as `"queued"`.

### Troubleshooting: "spawn python3 ENOENT" / analysis jobs fail immediately

The worker auto-detects a working Python 3 interpreter at startup (trying
`python3`, `python`, then `py -3`, in that order) and logs which one it picked —
check `[worker] Using Python interpreter: ...` in the server log. If none of those
names exist on your PATH, or the one it finds is missing `numpy`/`Pillow`/`scipy`,
you'll see a clear multi-line error (in the server log, and in that job's
`errorMsg` from `/api/queue/history`) telling you exactly what was tried. Fix it by
either installing the requirements (`pip install -r ai/requirements.txt
--break-system-packages`) or setting `PYTHON_BIN` in `backend/.env` explicitly to
the right interpreter, e.g. `PYTHON_BIN=python` or `PYTHON_BIN=/usr/bin/python3.11`.

### Demo logins (password: `password123`)
| Email | Role |
|---|---|
| admin@aipath.edu | Admin |
| ashiqur.rahman@aipath.edu | Pathologist |
| nabil.mohaimin@aipath.edu | Pathologist |
| nusrat.nabila@aipath.edu | Lab Technician |
| researcher@aipath.edu | Researcher |

## What's real here

Everything in this build is functionally real — there is no mock data left in the
frontend, and nothing is hard-coded/random on the backend:

- **Two-factor authentication (2FA)** — login is a genuine two-step flow: credentials validated first, then a 6-digit OTP is generated and emailed to the user's *registered email address* via Gmail (Nodemailer). The OTP is stored in Redis with a 10-minute TTL and deleted immediately after use, so it can't be replayed. Registration also triggers OTP verification before the session is issued. Dev mode: if `GMAIL_USER`/`GMAIL_APP_PASSWORD` aren't configured, the OTP is returned in the API response body (`_devOtp`) so you can log in and test without real Gmail credentials.
- **Real-time updates (Socket.IO)** — a Socket.IO server runs alongside the Express API on the same port. The BullMQ worker emits `job:progress`, `job:done`, `case:updated`, and `analysis:ready` events as analysis jobs run. The queue page, analysis viewer, and patients list all receive live push updates without polling. Clients join case-specific rooms (`join:case`) for targeted delivery; there's a 10-second polling fallback if the WebSocket connection drops.
- **Auth** — JWT-based register/login, bcrypt password hashing, role-based access control enforced on every API route (not just hidden in the UI).
- **Database** — real PostgreSQL (via `pg`, hand-written SQL — see note below on why not Prisma), with a proper `schema.sql` + idempotent migration runner.
- **Case management** — full CRUD for patient cases, notes, basic-info edits, status transitions, all persisted.
- **Image upload** — real multipart file upload (PNG/JPEG/TIFF/WEBP/BMP, up to 200MB), stored on disk, tied to a case.
- **AI inference pipeline** — a genuine computer-vision pipeline (see below), dispatched through a real **BullMQ + Redis job queue** with configurable worker concurrency — uploads beyond the concurrency limit genuinely queue and wait for a slot, the same way a GPU-bound inference service would in production. Progress is tracked in Postgres and pushed live to browsers via Socket.IO.
- **Reports** — real PDF generation (pdfkit) embedding the actual computed metrics, case notes, and slide image; downloadable.
- **Tumor board sharing** — token-based, expiring, unauthenticated read-only share links.
- **Audit log** — every significant action (login, upload, edits, approvals, admin actions) is recorded and viewable by admins.

## Honest scope note: the "AI" part

The proposal specifies EfficientNet-B0 and YOLO deep-learning models trained on
histopathology datasets (e.g. TCGA) with Grad-CAM explainability. **Training real
models like that requires labeled clinical datasets and GPU compute that aren't
available in this environment**, so instead `backend/ai/analyze.py` implements a
genuine, deterministic **computer-vision pipeline** using numpy/PIL/scipy:

- Adaptive thresholding + connected-component segmentation to find nuclei-like blobs
  (similar in spirit to QuPath's positive-pixel-count or ImageJ's IHC Profiler)
- Real staining/saturation and texture-heterogeneity analysis
- A density-based heatmap (Grad-CAM-*style*, not literally Grad-CAM) rendered from
  actual detected regions and alpha-blended over the real slide image
- Bounding boxes derived from real blob geometry, not placeholders

Every number in the output is a genuine function of the uploaded image's pixels —
nothing is random or hard-coded, so different slides produce different, reproducible
results. This is clearly documented in the script's docstring too. The output JSON
schema is intentionally shaped so a real trained PyTorch model could be swapped in
later (`backend/src/lib/inference.js` is the integration point) without touching the
Node backend or frontend.

## Why hand-written SQL instead of Prisma

Prisma's query engine binaries are fetched from `binaries.prisma.sh` at install
time, which was blocked in the environment this was originally built in — so the
data layer (`backend/src/lib/db.js` + `backend/src/models/*.js`) is hand-written SQL
against the standard `pg` driver instead. It's a thin, readable layer (one file per
entity — `users`, `cases`, `images`, `analysis`, `queue`, plus `misc` for
reports/shares/audit) and every query is parameterized against SQL injection. If
you'd prefer an ORM for a real deployment, swapping in Prisma or Drizzle would only
touch the `models/` folder and `schema.sql` — the routes call the same function names
either way.

## Why BullMQ + Redis for the analysis pipeline

The original version spawned a Python child process directly per upload, which works
for a demo but doesn't reflect how a real inference service behaves under load. BullMQ
gives us:
- **Real concurrency control** (`WORKER_CONCURRENCY`) — a stand-in for finite
  GPU/CPU inference capacity. Try uploading several slides at once and watching
  `/api/queue/active` — you'll see exactly N jobs "active" and the rest genuinely
  "queued" in Redis, not just cosmetically delayed.
- **Process independence** — the worker can run inside the API process (default, for
  a one-command demo) or as one/many separate `npm run worker` processes on different
  machines, all pulling from the same Redis queue, with zero code changes.
- **Durability** — jobs survive an API server restart since they live in Redis, not
  in-process memory.

The `queue_jobs` Postgres table remains the source of truth the REST API and
frontend poll against (job status, progress, ETA), updated by the worker as it runs
— BullMQ handles *dispatch and concurrency*, Postgres handles *state you can query*.

## Project structure

```
backend/
  docker-compose.yml   Postgres 16 + Redis 7 for local development
  src/
    server.js          Express app entrypoint (also starts the in-process worker)
    migrate.js           applies schema.sql to Postgres (idempotent)
    seed.js               demo users + sample cases
    routes/             auth, users, cases, queue, reports, shares, audit, dashboard
    models/             SQL query layer (users, cases, images, analysis, queue, misc)
    middleware/auth.js  JWT verification + RBAC
    lib/
      db.js              pg connection pool
      schema.sql          Postgres DDL
    queue/
      connection.js        shared ioredis connection
      analysisQueue.js      BullMQ Queue (producer) — enqueues uploads
      worker.js              BullMQ Worker (consumer) — runs analyze.py, concurrency-limited
  ai/
    analyze.py           the CV inference pipeline (see above)
  uploads/                uploaded slides, generated heatmaps/thumbnails, PDFs (gitignored)

frontend/
  app/                    Next.js App Router pages (login, dashboard, patients, queue,
                          analysis viewer, admin, reports, settings, support)
  components/             shared UI (AppShell, Sidebar, modals, cards, etc.)
  lib/
    api.ts                 fetch client (auth header, error handling)
    auth-context.tsx        real JWT session management
    patients-context.tsx    real case CRUD against the backend
    types.ts                 shared TypeScript types
```

## Known limitations / next steps

- DICOM isn't supported by the upload pipeline (PIL doesn't read it) — only
  PNG/JPEG/TIFF/WEBP/BMP. Adding `pydicom` support would be a small extension to
  `analyze.py`.
- No encryption at rest, no BAAs, no formal HIPAA certification — this is an academic
  demo, not a production clinical system (noted in-app on the Admin → Compliance tab).
- No retry/backoff policy on failed analysis jobs (`attempts: 1` in
  `analysisQueue.js`) — a production deployment would add BullMQ retry/backoff and
  a dead-letter queue for slides that repeatedly fail analysis.
- No Bull Board/queue dashboard wired up — would be a quick addition
  (`@bull-board/express`) if you want to visually inspect Redis queue state.
- The queue's progress bar is a smoothed approximation of the Python process's actual
  runtime (the one-shot script doesn't report fine-grained progress) — the AI results
  themselves are always exact and real.

-- AI-Path Assist — PostgreSQL schema
-- Applied idempotently by src/migrate.js (CREATE TABLE IF NOT EXISTS, etc.)

CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('admin', 'pathologist', 'lab_tech', 'researcher')),
  institution TEXT NOT NULL DEFAULT 'General Hospital Pathology Dept',
  status TEXT NOT NULL DEFAULT 'Active' CHECK (status IN ('Active', 'Invited', 'Deactivated', 'Pending')),
  last_login TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Widen the status CHECK constraint to include 'Pending' on databases that
-- were created before self-registration required admin approval. Safe to
-- re-run: drops and recreates the (default-named) constraint idempotently.
DO $$
BEGIN
  ALTER TABLE users DROP CONSTRAINT IF EXISTS users_status_check;
  ALTER TABLE users ADD CONSTRAINT users_status_check CHECK (status IN ('Active', 'Invited', 'Deactivated', 'Pending'));
END $$;

CREATE TABLE IF NOT EXISTS patient_cases (
  id TEXT PRIMARY KEY,
  case_code TEXT NOT NULL UNIQUE,
  patient_code TEXT NOT NULL,
  patient_name TEXT NOT NULL,
  age INTEGER NOT NULL,
  gender TEXT NOT NULL,
  specimen_type TEXT NOT NULL,
  date_added TIMESTAMPTZ NOT NULL DEFAULT now(),
  status TEXT NOT NULL DEFAULT 'Queued' CHECK (status IN ('Queued', 'Uploaded', 'Processing', 'Pending_Review', 'Completed', 'Failed')),
  upload_status TEXT NOT NULL DEFAULT 'Uploaded' CHECK (upload_status IN ('Uploaded', 'Processing', 'Processed')),
  diagnosis_status TEXT NOT NULL DEFAULT 'Pending' CHECK (diagnosis_status IN ('Pending', 'Reviewed', 'Completed')),
  report_approved BOOLEAN NOT NULL DEFAULT false,
  assigned_to_id TEXT REFERENCES users(id) ON DELETE SET NULL,
  assigned_to_name TEXT,
  created_by_id TEXT REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS case_notes (
  id TEXT PRIMARY KEY,
  case_id TEXT NOT NULL REFERENCES patient_cases(id) ON DELETE CASCADE,
  author_id TEXT REFERENCES users(id) ON DELETE SET NULL,
  author_name TEXT NOT NULL,
  text TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS slide_images (
  id TEXT PRIMARY KEY,
  case_id TEXT NOT NULL REFERENCES patient_cases(id) ON DELETE CASCADE,
  file_name TEXT NOT NULL,
  stored_path TEXT NOT NULL,
  mime_type TEXT NOT NULL,
  size_bytes BIGINT NOT NULL,
  uploaded_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS analysis_results (
  id TEXT PRIMARY KEY,
  image_id TEXT NOT NULL UNIQUE REFERENCES slide_images(id) ON DELETE CASCADE,
  case_id TEXT NOT NULL,
  metrics JSONB NOT NULL,
  boxes JSONB NOT NULL,
  tags JSONB NOT NULL,
  heatmap_path TEXT,
  overlay_path TEXT,
  thumbnail_path TEXT,
  engine_version TEXT NOT NULL DEFAULT 'AI-Path CV Engine v1.0 (heuristic pipeline)',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS queue_jobs (
  id TEXT PRIMARY KEY,
  case_id TEXT REFERENCES patient_cases(id) ON DELETE SET NULL,
  image_id TEXT REFERENCES slide_images(id) ON DELETE SET NULL,
  file_name TEXT NOT NULL,
  framework TEXT NOT NULL DEFAULT 'AI-Path CV Engine',
  status TEXT NOT NULL DEFAULT 'queued' CHECK (status IN ('queued', 'active', 'done', 'failed')),
  progress INTEGER NOT NULL DEFAULT 0,
  eta_seconds INTEGER NOT NULL DEFAULT 0,
  error_msg TEXT,
  bull_job_id TEXT,
  created_by_id TEXT REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS reports (
  id TEXT PRIMARY KEY,
  case_id TEXT NOT NULL REFERENCES patient_cases(id) ON DELETE CASCADE,
  report_code TEXT NOT NULL UNIQUE,
  signed_by TEXT NOT NULL,
  file_path TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS share_links (
  id TEXT PRIMARY KEY,
  case_id TEXT NOT NULL REFERENCES patient_cases(id) ON DELETE CASCADE,
  token TEXT NOT NULL UNIQUE,
  reviewers TEXT NOT NULL,
  note TEXT,
  created_by_id TEXT REFERENCES users(id) ON DELETE SET NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS audit_entries (
  id TEXT PRIMARY KEY,
  actor_id TEXT REFERENCES users(id) ON DELETE SET NULL,
  actor_name TEXT NOT NULL,
  action TEXT NOT NULL,
  target TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Researcher requests to view processing-queue data for a bounded date
-- range. Nothing is visible to the researcher until an admin approves the
-- specific request; approval only grants visibility for that date range.
CREATE TABLE IF NOT EXISTS queue_access_requests (
  id TEXT PRIMARY KEY,
  requested_by_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  reason TEXT,
  status TEXT NOT NULL DEFAULT 'Pending' CHECK (status IN ('Pending', 'Approved', 'Denied')),
  reviewed_by_id TEXT REFERENCES users(id) ON DELETE SET NULL,
  decision_note TEXT,
  reviewed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (end_date >= start_date)
);
CREATE INDEX IF NOT EXISTS idx_queue_access_requester ON queue_access_requests(requested_by_id);
CREATE INDEX IF NOT EXISTS idx_queue_access_status ON queue_access_requests(status);

CREATE INDEX IF NOT EXISTS idx_cases_assigned ON patient_cases(assigned_to_id);
CREATE INDEX IF NOT EXISTS idx_notes_case ON case_notes(case_id);
CREATE INDEX IF NOT EXISTS idx_images_case ON slide_images(case_id);
CREATE INDEX IF NOT EXISTS idx_queue_case ON queue_jobs(case_id);
CREATE INDEX IF NOT EXISTS idx_queue_status ON queue_jobs(status);
CREATE INDEX IF NOT EXISTS idx_audit_created ON audit_entries(created_at DESC);

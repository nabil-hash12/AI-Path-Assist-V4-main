# AI-Path Assist — Frontend

A complete Next.js 14 (App Router) + TypeScript + Tailwind implementation of the AI-Path
Assist clinical pathology platform, built from your project proposal and the 6 Stitch
mockups you provided (landing, login, registration, doctor dashboard, batch queue,
AI inference viewer).

This is the **frontend only** — it runs against mock data (`lib/mock-data.ts`) and a
client-side mock auth/session layer (`lib/auth-context.tsx`) so every screen is fully
clickable today. Swap the mock data calls for real API calls to your Node/Express +
FastAPI services when the backend is ready — the components are already structured
around that boundary (see "Wiring up the real backend" below).

## Getting started

```bash
npm install
npm run dev
```

Open http://localhost:3000. Register a new account (any email/password — pick a role),
or use Login and pick "Sign in as" a role directly (demo mode: any 6-digit code passes 2FA).

## What's included

### Design system
`tailwind.config.ts` and `app/globals.css` encode the exact token system from your
Stitch `DESIGN.md` and mockups (Midnight Clinical dark palette, Inter + JetBrains Mono,
glass panels, slim toggles, animated progress stripes) so every page shares one visual
language.

### Pages (all roles)
| Route | Description | Roles |
|---|---|---|
| `/` | Public landing page | everyone |
| `/login`, `/register` | Auth flows (2FA step, 3-step registration) | everyone |
| `/dashboard` | Clinical overview: active cases, pending reviews, patient registry, system activity | admin, pathologist, researcher |
| `/analysis` | Case picker | admin, pathologist, researcher |
| `/analysis/[caseId]` | **AI inference viewer**: Grad-CAM toggle + opacity/resolution sliders, annotation toolbar, biomarker panel, Tumor Board Share modal, Generate Report modal | admin, pathologist, researcher |
| `/queue` | Batch upload (drag-and-drop), active processing queue, history, notification settings | admin, pathologist, lab_tech |
| `/patients`, `/patients/[id]` | Full patient registry + case detail | admin, pathologist |
| `/reports` | Signed diagnostic report list | admin, pathologist |
| `/admin` | **New page** (not in original mockups, built to match the design system): user management, audit log, compliance & policy toggles | admin only |
| `/settings`, `/support` | Account/security/notification prefs, FAQ + contact | everyone |

### Shared components (`components/`)
`Sidebar` (role-aware nav), `TopBar`, `Footer`, `AppShell` (route guard + layout),
`MetricCard`, `StatusChip`, `Toggle`, `Modal`.

### RBAC
`lib/auth-context.tsx` stores `{ name, email, role, institution }` and `AppShell`'s
`allow` prop redirects users away from routes their role can't access — mirroring the
role matrix in your proposal (Pathologist / Lab Technician / Administrator / Researcher).

### Patient records (`lib/patients-context.tsx`)
A shared, persisted (localStorage-backed) data store for patient/case records, used by
every page that reads or writes patient data (Dashboard, Analysis, Patients, Queue,
Reports). This is what makes **New Patient** and the **Lab Technician** features work
end-to-end today, without a backend:

- **New Patient** — the "+ New Patient" button (Patient Registry page and Batch
  Processing Queue page) opens `components/NewPatientModal.tsx`, which creates a new
  case record (auto-generated case ID + patient ID if left blank).
- **Lab Technician role features**, all live on `/patients` and `/patients/[id]`:
  - *Upload patient images* — drag-and-drop / file picker on the patient detail page.
  - *Create and update patient case records* — New Patient modal + editable "Case
    Record" section (specimen type, assigned pathologist).
  - *Assign scans to patients* — per-file "Select patient…" + Assign control on the
    Queue page, and direct per-patient upload on the patient detail page.
  - *View patient list (basic access)* — `/patients` shows a reduced column set
    (ID, name, age/gender, upload status) for the `lab_tech` role instead of the full
    clinical view pathologists/admins see.
  - *Edit patient basic info* (name, age, gender) — editable "Basic Info" card on the
    patient detail page.
  - *Track upload status* — a 3-step Uploaded → Processing → Processed tracker with a
    "Mark as next step" action.

Pathologists/admins instead see the clinical view on `/patients/[id]`: biomarker panel,
case notes (with add-note), and shortcuts into the AI inference viewer and Reports.

## Wiring up the real backend

Replace these files' internals without touching page components:
- `lib/mock-data.ts` (seed arrays) and `lib/patients-context.tsx` (CRUD) → replace with
  `fetch`/API-client calls to your Express REST API (cases, queue jobs, biomarkers,
  audit log, users). Keep the same hook shape (`usePatients()` returning the same
  methods) so no page needs to change.
- `lib/auth-context.tsx` → replace the mock `login`/`register`/`logout` bodies with real
  calls to your auth endpoints (JWT/session cookie), keeping the same function
  signatures so no page needs to change.

The AI inference viewer's Grad-CAM overlay and biomarker cards are already isolated in
`app/analysis/[caseId]/page.tsx` — point them at your FastAPI inference service's
response shape (overlay image URL + per-marker score/confidence) in place of the mock
`biomarkersByCase` lookup.

## Notes
- Fonts (Inter, JetBrains Mono, Material Symbols) load via `<link>` tags rather than
  `next/font/google`, matching the original mockups and keeping builds
  network-independent in restricted sandboxes.
- No `localStorage`/browser APIs are required beyond persisting the mock session, which
  is safe here since this is a real Next.js app (not a single-file preview artifact).

# Certificate Registry Prototype (docker-compose)

This is a **local-first** prototype scaffold for a certificate registry system.

**Services (separated as requested):**
- `db` — PostgreSQL
- `backend` — NestJS (TypeScript) + Prisma
- `frontend` — React (Vite, TypeScript)

## Quick start

1) Copy env file:

```bash
cp .env.example .env
```

2) Build & run everything with **one command**:

```bash
docker compose up --build
```

3) Open:
- Frontend: http://localhost:5173
- Backend health: http://localhost:3000/health

## Dev users (bootstrapped on startup)

If `DEV_BOOTSTRAP=true`, the backend creates default users and demo data idempotently:

- **Admin**: `admin@example.com / admin123`
- **Creator (enters exam attempts)**: `creator@example.com / creator123`
- **Signer (approves/rejects)**: `signer@example.com / signer123`

Credentials can be changed in `.env`.

## What is implemented

- Working docker-compose with DB + backend + frontend
- Backend `/health` endpoint checks DB connectivity
- Public verify route:
  - `GET /certs/outer/:publicId` (no auth, no personal data)
- Internal view route:
  - `GET /certs/inner/:publicId` (JWT + `certificate:view_internal`)

### Iteration 1: JWT + RBAC ✅

- `POST /auth/login` issues JWT
- `GET /auth/me` returns current user + permissions
- Internal contour is protected via `PermissionsGuard`

### Iteration 2: Exam attempts + approvals (verifiable) ✅

- **Exam types** (for dropdown):
  - `GET /exam-types` (JWT)
- **Users list** (for choosing signer):
  - `GET /users` (JWT + `users:read`)
- **Attempts**:
  - `GET /attempts/mine` (JWT)
  - `POST /attempts` (JWT + `exam:create`)
  - `POST /attempts/:id/submit` (JWT + `exam:submit`)
- **Approvals**:
  - `GET /approvals/inbox` (JWT + `approval:review`)
  - `POST /approvals/:id/approve` (JWT + `approval:approve`)
  - `POST /approvals/:id/reject` (JWT + `approval:reject`)
  - `POST /approvals/bulk` (JWT + `approval:bulk_action`)

The backend seeds a demo **draft** attempt (marker `DEMO_ATTEMPT_V1`) created by the **Creator**, assigned to the **Signer**.

### Iteration 3: Certificate issuance + validity + public verify statuses ✅

When the signer **approves** an attempt, a **Certificate** is issued automatically:
- unique `certificateNumber` (sequential per year + exam type)
- `publicId` (used for verification URL)
- validity (`validityType`, optional `validTo`) calculated from exam type defaults

Public verify route returns one of:
- `valid`
- `expired`
- `revoked`
- `annulled`
- `not_found`

Extra internal endpoints (admin):
- `POST /api/internal/certs/:publicId/revoke`
- `POST /api/internal/certs/:publicId/annul`

Demo public verification link (bootstrapped):
- `GET /certs/outer/demo-public-id-12345`

### Iteration 4: Templates + PDF generation (internal only) + QR ✅

- **Templates & versions**:
  - `GET /template-versions/active` (JWT) — for selecting a template during attempt creation
  - `GET /api/internal/templates` (JWT + `templates:manage`)
  - `POST /api/internal/templates` (JWT + `templates:manage`)
  - `POST /api/internal/templates/:templateId/versions` (multipart, JWT + `templates:manage`) — upload background + config JSON
- **PDF generation** (no storage):
  - `GET /api/internal/certs/:publicId/pdf` (JWT + `certificate:view_internal`) — generates PDF on demand
  - PDF embeds a QR code leading to `PUBLIC_VERIFY_BASE_URL/certs/outer/:publicId`

New env vars:
- `TEMPLATE_STORAGE_DIR` — where template backgrounds are stored in the backend container (`/app/data/templates` by default)
- `PUBLIC_VERIFY_BASE_URL` — base URL used for QR/verify links (default `http://localhost:3000`)

## Next iterations

### Iteration 5: Certificate registry (filters/search) + CSV export ✅

- **Registry list**:
  - `GET /api/internal/certificates` (JWT + `certificate:view_internal`)
    - supports: `q`, `status` (issued/revoked/annulled/expired), `grade`, `examTypeId`, `validity` (active/expired), `issuedFrom/issuedTo`, `examFrom/examTo`, `page`, `pageSize`
- **CSV export** (same filters):
  - `GET /api/internal/certificates/export.csv` (JWT + `export:run`)
    - limit: 5000 rows per export

6) Notifications (Outbox + email provider)

## Notes

- No PDF files are stored. Certificates will be generated on demand in the internal contour.
- Public contour exposes only validity status (no personal data).

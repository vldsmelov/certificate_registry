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

If `backend` starts before `db` is ready, it will retry Prisma connect automatically (compose also uses a healthcheck).

## What is implemented in this scaffold

- Working docker-compose with DB + backend + frontend
- Backend `/health` endpoint checks DB connectivity
- Basic DB schema + migration (Prisma migrate deploy)
- Placeholder routes for future:
  - Public verify: `/certs/outer/:publicId`
  - Internal view: `/certs/inner/:publicId`
  - Internal PDF stream: `/api/internal/certs/:publicId/pdf` (returns 501 for now)

## Next iterations (we will implement step-by-step with verifiable results)

1) Auth (JWT) + RBAC permissions + seed admin
2) Exam attempts (create/submit) + approvals inbox + bulk approve/reject
3) Certificate issuance (number + public_id) + validity (fixed/duration/perpetual) + public verify status
4) Templates (multiple templates + versions) + PDF generation on-demand (internal only) + QR linking to outer verify
5) Export (CSV/XLSX) + advanced filters/search
6) Notifications (Outbox + email provider)

## Notes

- No PDF files are stored. Certificates will be generated on demand in the internal contour.
- Public contour exposes only validity status (no personal data).


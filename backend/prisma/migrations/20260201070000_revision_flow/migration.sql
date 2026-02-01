-- Iteration 7: revision flow (edit certificate -> pending -> re-sign)

-- 1) Add enum value for pending status
ALTER TYPE "CertificateStatus" ADD VALUE IF NOT EXISTS 'pending';

-- 2) Approval: mark revision approvals
ALTER TABLE "Approval"
  ADD COLUMN IF NOT EXISTS "isRevision" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "note" TEXT;

-- 3) Certificate: revision metadata
ALTER TABLE "Certificate"
  ADD COLUMN IF NOT EXISTS "editedAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "editedById" TEXT,
  ADD COLUMN IF NOT EXISTS "editNote" TEXT;

-- 4) FK for editedById
ALTER TABLE "Certificate" DROP CONSTRAINT IF EXISTS "Certificate_editedById_fkey";
ALTER TABLE "Certificate"
  ADD CONSTRAINT "Certificate_editedById_fkey" FOREIGN KEY ("editedById") REFERENCES "AppUser"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- 5) Helpful indexes
CREATE INDEX IF NOT EXISTS "Certificate_editedAt_idx" ON "Certificate"("editedAt");
CREATE INDEX IF NOT EXISTS "Approval_isRevision_idx" ON "Approval"("isRevision");

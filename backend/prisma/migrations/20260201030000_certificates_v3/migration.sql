-- Add ValidityType enum
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'ValidityType') THEN
    CREATE TYPE "ValidityType" AS ENUM ('fixed_date', 'duration', 'perpetual');
  END IF;
END$$;

-- Extend ExamType with default validity rules
ALTER TABLE "ExamType"
  ADD COLUMN IF NOT EXISTS "defaultValidityType" "ValidityType" NOT NULL DEFAULT 'duration',
  ADD COLUMN IF NOT EXISTS "defaultValidityMonths" INTEGER NOT NULL DEFAULT 36,
  ADD COLUMN IF NOT EXISTS "defaultValidTo" TIMESTAMP(3);

-- Create certificate counter table (for sequential certificate numbers per year & exam type)
CREATE TABLE IF NOT EXISTS "CertificateCounter" (
  "id" TEXT NOT NULL DEFAULT gen_random_uuid(),
  "examTypeId" TEXT NOT NULL,
  "year" INTEGER NOT NULL,
  "seq" INTEGER NOT NULL,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "CertificateCounter_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "CertificateCounter_examTypeId_year_key" ON "CertificateCounter"("examTypeId", "year");

ALTER TABLE "CertificateCounter"
  ADD CONSTRAINT "CertificateCounter_examTypeId_fkey" FOREIGN KEY ("examTypeId") REFERENCES "ExamType"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Upgrade Certificate model: tie to attempt, add validity & revocation metadata
ALTER TABLE "Certificate"
  ADD COLUMN IF NOT EXISTS "validityType" "ValidityType" NOT NULL DEFAULT 'duration',
  ADD COLUMN IF NOT EXISTS "validityMonths" INTEGER,
  ADD COLUMN IF NOT EXISTS "revokedAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "revokedById" TEXT,
  ADD COLUMN IF NOT EXISTS "revokeReason" TEXT;

-- Drop legacy FKs before column changes
ALTER TABLE "Certificate" DROP CONSTRAINT IF EXISTS "Certificate_personId_fkey";
ALTER TABLE "Certificate" DROP CONSTRAINT IF EXISTS "Certificate_examTypeId_fkey";
ALTER TABLE "Certificate" DROP CONSTRAINT IF EXISTS "Certificate_examAttemptId_fkey";

-- Remove legacy columns (certificate is linked to ExamAttempt)
ALTER TABLE "Certificate" DROP COLUMN IF EXISTS "personId";
ALTER TABLE "Certificate" DROP COLUMN IF EXISTS "examTypeId";

-- Make examAttemptId required and ensure FK
ALTER TABLE "Certificate" ALTER COLUMN "examAttemptId" SET NOT NULL;

ALTER TABLE "Certificate"
  ADD CONSTRAINT "Certificate_examAttemptId_fkey" FOREIGN KEY ("examAttemptId") REFERENCES "ExamAttempt"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "Certificate"
  ADD CONSTRAINT "Certificate_revokedById_fkey" FOREIGN KEY ("revokedById") REFERENCES "AppUser"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Ensure index exists
CREATE INDEX IF NOT EXISTS "Certificate_examAttemptId_idx" ON "Certificate"("examAttemptId");

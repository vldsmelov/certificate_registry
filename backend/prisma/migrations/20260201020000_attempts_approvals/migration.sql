-- CreateEnum
CREATE TYPE "AttemptStatus" AS ENUM ('draft', 'submitted', 'needs_fix', 'approved', 'rejected', 'failed');

-- CreateEnum
CREATE TYPE "ApprovalStatus" AS ENUM ('pending', 'approved', 'rejected');

-- AlterTable Person
ALTER TABLE "Person" ADD COLUMN "employeeCode" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "Person_employeeCode_key" ON "Person"("employeeCode");

-- CreateTable
CREATE TABLE "ExamAttempt" (
  "id" TEXT NOT NULL DEFAULT gen_random_uuid(),
  "personId" TEXT NOT NULL,
  "examTypeId" TEXT NOT NULL,
  "attemptNo" INTEGER NOT NULL,
  "grade" "Grade" NOT NULL,
  "examDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "status" "AttemptStatus" NOT NULL DEFAULT 'draft',
  "signerUserId" TEXT,
  "createdById" TEXT NOT NULL,
  "notes" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "ExamAttempt_pkey" PRIMARY KEY ("id")
);

-- Indexes
CREATE UNIQUE INDEX "ExamAttempt_personId_examTypeId_attemptNo_key" ON "ExamAttempt"("personId", "examTypeId", "attemptNo");
CREATE INDEX "ExamAttempt_status_idx" ON "ExamAttempt"("status");
CREATE INDEX "ExamAttempt_signerUserId_idx" ON "ExamAttempt"("signerUserId");
CREATE INDEX "ExamAttempt_createdById_idx" ON "ExamAttempt"("createdById");
CREATE INDEX "ExamAttempt_examDate_idx" ON "ExamAttempt"("examDate");

-- FKs
ALTER TABLE "ExamAttempt" ADD CONSTRAINT "ExamAttempt_personId_fkey" FOREIGN KEY ("personId") REFERENCES "Person"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ExamAttempt" ADD CONSTRAINT "ExamAttempt_examTypeId_fkey" FOREIGN KEY ("examTypeId") REFERENCES "ExamType"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ExamAttempt" ADD CONSTRAINT "ExamAttempt_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "AppUser"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ExamAttempt" ADD CONSTRAINT "ExamAttempt_signerUserId_fkey" FOREIGN KEY ("signerUserId") REFERENCES "AppUser"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- CreateTable
CREATE TABLE "Approval" (
  "id" TEXT NOT NULL DEFAULT gen_random_uuid(),
  "examAttemptId" TEXT NOT NULL,
  "signerUserId" TEXT NOT NULL,
  "status" "ApprovalStatus" NOT NULL DEFAULT 'pending',
  "reason" TEXT,
  "decidedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "Approval_pkey" PRIMARY KEY ("id")
);

-- Indexes
CREATE INDEX "Approval_signerUserId_status_idx" ON "Approval"("signerUserId", "status");
CREATE INDEX "Approval_examAttemptId_idx" ON "Approval"("examAttemptId");

-- FKs
ALTER TABLE "Approval" ADD CONSTRAINT "Approval_examAttemptId_fkey" FOREIGN KEY ("examAttemptId") REFERENCES "ExamAttempt"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Approval" ADD CONSTRAINT "Approval_signerUserId_fkey" FOREIGN KEY ("signerUserId") REFERENCES "AppUser"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AlterTable Certificate
ALTER TABLE "Certificate" ADD COLUMN "examAttemptId" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "Certificate_examAttemptId_key" ON "Certificate"("examAttemptId");

-- AddForeignKey
ALTER TABLE "Certificate" ADD CONSTRAINT "Certificate_examAttemptId_fkey" FOREIGN KEY ("examAttemptId") REFERENCES "ExamAttempt"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Templates and versions

-- CreateTable
CREATE TABLE "Template" (
  "id" TEXT NOT NULL DEFAULT gen_random_uuid(),
  "name" TEXT NOT NULL,
  "description" TEXT,
  "isArchived" BOOLEAN NOT NULL DEFAULT false,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "createdById" TEXT,
  CONSTRAINT "Template_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TemplateVersion" (
  "id" TEXT NOT NULL DEFAULT gen_random_uuid(),
  "templateId" TEXT NOT NULL,
  "version" INTEGER NOT NULL,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "backgroundPath" TEXT,
  "configJson" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "createdById" TEXT,
  CONSTRAINT "TemplateVersion_pkey" PRIMARY KEY ("id")
);

-- Add columns
ALTER TABLE "ExamType" ADD COLUMN IF NOT EXISTS "defaultTemplateVersionId" TEXT;
ALTER TABLE "ExamAttempt" ADD COLUMN IF NOT EXISTS "templateVersionId" TEXT;
ALTER TABLE "Certificate" ADD COLUMN IF NOT EXISTS "templateVersionId" TEXT;

-- Indexes
CREATE UNIQUE INDEX IF NOT EXISTS "TemplateVersion_templateId_version_key" ON "TemplateVersion"("templateId", "version");
CREATE INDEX IF NOT EXISTS "TemplateVersion_templateId_isActive_idx" ON "TemplateVersion"("templateId", "isActive");

CREATE INDEX IF NOT EXISTS "ExamType_defaultTemplateVersionId_idx" ON "ExamType"("defaultTemplateVersionId");
CREATE INDEX IF NOT EXISTS "ExamAttempt_templateVersionId_idx" ON "ExamAttempt"("templateVersionId");
CREATE INDEX IF NOT EXISTS "Certificate_templateVersionId_idx" ON "Certificate"("templateVersionId");

-- FKs
ALTER TABLE "Template" ADD CONSTRAINT "Template_createdById_fkey"
  FOREIGN KEY ("createdById") REFERENCES "AppUser"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "TemplateVersion" ADD CONSTRAINT "TemplateVersion_templateId_fkey"
  FOREIGN KEY ("templateId") REFERENCES "Template"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "TemplateVersion" ADD CONSTRAINT "TemplateVersion_createdById_fkey"
  FOREIGN KEY ("createdById") REFERENCES "AppUser"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "ExamType" ADD CONSTRAINT "ExamType_defaultTemplateVersionId_fkey"
  FOREIGN KEY ("defaultTemplateVersionId") REFERENCES "TemplateVersion"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "ExamAttempt" ADD CONSTRAINT "ExamAttempt_templateVersionId_fkey"
  FOREIGN KEY ("templateVersionId") REFERENCES "TemplateVersion"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "Certificate" ADD CONSTRAINT "Certificate_templateVersionId_fkey"
  FOREIGN KEY ("templateVersionId") REFERENCES "TemplateVersion"("id") ON DELETE SET NULL ON UPDATE CASCADE;

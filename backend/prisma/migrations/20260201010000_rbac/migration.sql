-- Add fields to AppUser
ALTER TABLE "AppUser" ADD COLUMN IF NOT EXISTS "displayName" TEXT;
ALTER TABLE "AppUser" ADD COLUMN IF NOT EXISTS "isActive" BOOLEAN NOT NULL DEFAULT TRUE;

-- CreateTable Role
CREATE TABLE IF NOT EXISTS "Role" (
  "id" TEXT NOT NULL DEFAULT gen_random_uuid(),
  "code" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Role_pkey" PRIMARY KEY ("id")
);

-- CreateTable Permission
CREATE TABLE IF NOT EXISTS "Permission" (
  "id" TEXT NOT NULL DEFAULT gen_random_uuid(),
  "code" TEXT NOT NULL,
  "description" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Permission_pkey" PRIMARY KEY ("id")
);

-- CreateTable UserRole
CREATE TABLE IF NOT EXISTS "UserRole" (
  "userId" TEXT NOT NULL,
  "roleId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "UserRole_pkey" PRIMARY KEY ("userId", "roleId")
);

-- CreateTable RolePermission
CREATE TABLE IF NOT EXISTS "RolePermission" (
  "roleId" TEXT NOT NULL,
  "permissionId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "RolePermission_pkey" PRIMARY KEY ("roleId", "permissionId")
);

-- Unique indexes
CREATE UNIQUE INDEX IF NOT EXISTS "Role_code_key" ON "Role"("code");
CREATE UNIQUE INDEX IF NOT EXISTS "Permission_code_key" ON "Permission"("code");

-- Indexes
CREATE INDEX IF NOT EXISTS "UserRole_roleId_idx" ON "UserRole"("roleId");
CREATE INDEX IF NOT EXISTS "RolePermission_permissionId_idx" ON "RolePermission"("permissionId");

-- FKs
ALTER TABLE "UserRole" ADD CONSTRAINT "UserRole_userId_fkey" FOREIGN KEY ("userId") REFERENCES "AppUser"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "UserRole" ADD CONSTRAINT "UserRole_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "Role"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "RolePermission" ADD CONSTRAINT "RolePermission_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "Role"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "RolePermission" ADD CONSTRAINT "RolePermission_permissionId_fkey" FOREIGN KEY ("permissionId") REFERENCES "Permission"("id") ON DELETE CASCADE ON UPDATE CASCADE;

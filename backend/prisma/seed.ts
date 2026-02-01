import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  // RBAC bootstrap (idempotent)
  const permissions = [
    'exam:create',
    'exam:edit_own',
    'exam:submit',
    'approval:review',
    'approval:approve',
    'approval:reject',
    'approval:bulk_action',
    'certificate:view_internal',
    'export:run',
    'templates:manage',
    'users:manage',
  ];

  for (const code of permissions) {
    await prisma.permission.upsert({ where: { code }, update: {}, create: { code } });
  }

  const adminRole = await prisma.role.upsert({
    where: { code: 'admin' },
    update: {},
    create: { code: 'admin', name: 'Admin' },
  });

  // Link all permissions to admin role
  const allPerms = await prisma.permission.findMany({ select: { id: true } });
  for (const p of allPerms) {
    await prisma.rolePermission.upsert({
      where: { roleId_permissionId: { roleId: adminRole.id, permissionId: p.id } },
      update: {},
      create: { roleId: adminRole.id, permissionId: p.id },
    });
  }

  const adminEmail = process.env.ADMIN_EMAIL || 'admin@example.com';
  const adminPassword = process.env.ADMIN_PASSWORD || 'admin123';
  const passwordHash = await bcrypt.hash(adminPassword, 10);
  const adminUser = await prisma.appUser.upsert({
    where: { email: adminEmail },
    update: { isActive: true },
    create: { email: adminEmail, passwordHash, displayName: 'Administrator', isActive: true },
  });
  await prisma.userRole.upsert({
    where: { userId_roleId: { userId: adminUser.id, roleId: adminRole.id } },
    update: {},
    create: { userId: adminUser.id, roleId: adminRole.id },
  });

  const examType = await prisma.examType.upsert({
    where: { code: 'DEMO' },
    update: {},
    create: { name: 'Demo Exam', code: 'DEMO' },
  });

  const person = await prisma.person.create({
    data: { fullName: 'Иванов Иван Иванович', position: 'Инженер' },
  });

  // Create a single demo certificate
  const publicId = 'demo-public-id-12345';
  await prisma.certificate.upsert({
    where: { publicId },
    update: {},
    create: {
      certificateNumber: '2026-DEMO-000001',
      publicId,
      grade: 'gold',
      status: 'issued',
      issuedAt: new Date(),
      validFrom: new Date(),
      validTo: new Date(Date.now() + 1000 * 60 * 60 * 24 * 365), // +1 year
      personId: person.id,
      examTypeId: examType.id,
      renderSnapshotJson: {
        fullName: person.fullName,
        position: person.position,
        examTypeName: examType.name,
        examTypeCode: examType.code,
        grade: 'gold',
        certificateNumber: '2026-DEMO-000001',
        publicId,
      },
    },
  });

  console.log('Seeded demo data. Try: GET /certs/outer/demo-public-id-12345');
  console.log(`Seeded admin user. Email: ${adminEmail} Password: ${adminPassword}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

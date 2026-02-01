import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function ensurePermission(code: string, description?: string) {
  await prisma.permission.upsert({
    where: { code },
    update: { description: description ?? undefined },
    create: { code, description },
  });
}

async function ensureRole(roleCode: string, roleName: string, permissionCodes: string[]) {
  const role = await prisma.role.upsert({
    where: { code: roleCode },
    update: { name: roleName },
    create: { code: roleCode, name: roleName },
  });

  const perms = await prisma.permission.findMany({ where: { code: { in: permissionCodes } }, select: { id: true } });
  for (const p of perms) {
    await prisma.rolePermission.upsert({
      where: { roleId_permissionId: { roleId: role.id, permissionId: p.id } },
      update: {},
      create: { roleId: role.id, permissionId: p.id },
    });
  }

  return role;
}

async function ensureUser(emailRaw: string, password: string, displayName: string, roleCodes: string[]) {
  const email = emailRaw.trim().toLowerCase();
  const existing = await prisma.appUser.findUnique({ where: { email } });

  let userId: string;
  if (!existing) {
    const passwordHash = await bcrypt.hash(password, 10);
    const u = await prisma.appUser.create({ data: { email, passwordHash, displayName, isActive: true } });
    userId = u.id;
  } else {
    await prisma.appUser.update({ where: { id: existing.id }, data: { isActive: true, displayName } });
    userId = existing.id;
  }

  for (const roleCode of roleCodes) {
    const role = await prisma.role.findUnique({ where: { code: roleCode } });
    if (!role) continue;
    await prisma.userRole.upsert({
      where: { userId_roleId: { userId, roleId: role.id } },
      update: {},
      create: { userId, roleId: role.id },
    });
  }

  return userId;
}

async function main() {
  const permissionCodes = [
    'exam:create',
    'exam:edit_own',
    'exam:submit',
    'approval:review',
    'approval:approve',
    'approval:reject',
    'approval:bulk_action',
    'certificate:view_internal',
    'certificate:revoke',
    'export:run',
    'templates:manage',
    'users:read',
    'users:manage',
  ];

  for (const code of permissionCodes) await ensurePermission(code);

  await ensureRole('admin', 'Admin', permissionCodes);
  await ensureRole('creator', 'Creator', ['exam:create', 'exam:edit_own', 'exam:submit', 'users:read', 'certificate:view_internal']);
  await ensureRole('signer', 'Signer', ['approval:review', 'approval:approve', 'approval:reject', 'approval:bulk_action']);

  const adminEmail = process.env.ADMIN_EMAIL || 'admin@example.com';
  const adminPassword = process.env.ADMIN_PASSWORD || 'admin123';
  const creatorEmail = process.env.CREATOR_EMAIL || 'creator@example.com';
  const creatorPassword = process.env.CREATOR_PASSWORD || 'creator123';
  const signerEmail = process.env.SIGNER_EMAIL || 'signer@example.com';
  const signerPassword = process.env.SIGNER_PASSWORD || 'signer123';

  const adminId = await ensureUser(adminEmail, adminPassword, 'Administrator', ['admin']);
  const creatorId = await ensureUser(creatorEmail, creatorPassword, 'Exam Creator', ['creator']);
  const signerId = await ensureUser(signerEmail, signerPassword, 'Exam Signer', ['signer']);

  await prisma.examType.upsert({
    where: { code: 'DEMO' },
    update: { defaultValidityType: 'perpetual' as any, defaultValidityMonths: 0 },
    create: { name: 'Demo Exam', code: 'DEMO', defaultValidityType: 'perpetual' as any, defaultValidityMonths: 0 },
  });
  await prisma.examType.upsert({
    where: { code: 'SAFE' },
    update: { defaultValidityType: 'duration' as any, defaultValidityMonths: 36 },
    create: { name: 'Safety Basics', code: 'SAFE', defaultValidityType: 'duration' as any, defaultValidityMonths: 36 },
  });
  await prisma.examType.upsert({
    where: { code: 'FAID' },
    update: { defaultValidityType: 'duration' as any, defaultValidityMonths: 24 },
    create: { name: 'First Aid', code: 'FAID', defaultValidityType: 'duration' as any, defaultValidityMonths: 24 },
  // --- Templates (demo) ---
  const defaultCfg = {
    page: { orientation: 'landscape' },
    fields: {
      title: { x: 60, y: 530, size: 28 },
      fullName: { x: 60, y: 430, size: 22 },
      position: { x: 60, y: 390, size: 14 },
      examTypeName: { x: 60, y: 360, size: 14 },
      grade: { x: 60, y: 330, size: 14 },
      certificateNumber: { x: 60, y: 300, size: 14 },
      issuedAt: { x: 60, y: 270, size: 12 },
      validTo: { x: 60, y: 245, size: 12 },
      signerName: { x: 60, y: 200, size: 12 },
      qr: { x: 670, y: 155, size: 150 },
      verifyUrl: { x: 60, y: 120, size: 10 },
    },
  };

  let template = await prisma.template.findFirst({ where: { name: 'Default Certificate Template' } });
  if (!template) {
    template = await prisma.template.create({
      data: {
        name: 'Default Certificate Template',
        description: 'Demo template without background image (text-only).',
        createdById: adminId,
      },
    });
  }

  let v1 = await prisma.templateVersion.findFirst({ where: { templateId: template.id, version: 1 } });
  if (!v1) {
    v1 = await prisma.templateVersion.create({
      data: {
        templateId: template.id,
        version: 1,
        isActive: true,
        backgroundPath: null,
        configJson: defaultCfg as any,
        createdById: adminId,
      },
    });
  } else if (!v1.isActive) {
    v1 = await prisma.templateVersion.update({ where: { id: v1.id }, data: { isActive: true, configJson: defaultCfg as any } });
  }

  // Set default template for exam types (demo)
  await prisma.examType.updateMany({
    where: { code: { in: ['DEMO', 'SAFE', 'FAID'] } },
    data: { defaultTemplateVersionId: v1.id },
  });

  });

  // Demo certificate (public verify)
  const publicId = 'demo-public-id-12345';
  const existingCert = await prisma.certificate.findUnique({ where: { publicId } });
  if (!existingCert) {
    const examType = await prisma.examType.findUnique({ where: { code: 'DEMO' } });
    const person = await prisma.person.upsert({
      where: { employeeCode: 'DEMO-001' },
      update: { fullName: 'Иванов Иван Иванович', position: 'Инженер' },
      create: { fullName: 'Иванов Иван Иванович', position: 'Инженер', employeeCode: 'DEMO-001' },
    });

    const issuedAt = new Date();
    const year = issuedAt.getUTCFullYear();
    const certificateNumber = `${year}-DEMO-000001`;

    await prisma.certificateCounter.upsert({
      where: { examTypeId_year: { examTypeId: examType!.id, year } },
      update: { seq: 1 },
      create: { examTypeId: examType!.id, year, seq: 1 },
    });

    const attempt = await prisma.examAttempt.create({
      data: {
        personId: person.id,
        examTypeId: examType!.id,
        attemptNo: 1,
        grade: 'gold' as any,
        examDate: issuedAt,
        status: 'approved' as any,
        signerUserId: signerId,
        createdById: adminId,
        templateVersionId: v1.id,
        notes: 'DEMO_CERT_ATTEMPT_V1',
      },
    });

    await prisma.certificate.create({
      data: {
        certificateNumber,
        publicId,
        grade: 'gold' as any,
        status: 'issued' as any,
        issuedAt,
        validityType: examType!.defaultValidityType as any,
        validityMonths: examType!.defaultValidityType === 'duration' ? examType!.defaultValidityMonths : null,
        validFrom: issuedAt,
        validTo: null,
        templateVersionId: v1.id,
        examAttemptId: attempt.id,
      },
    });
  }

  // Demo attempt (internal workflow)
  const marker = 'DEMO_ATTEMPT_V1';
  const existingAttempt = await prisma.examAttempt.findFirst({ where: { notes: marker } });
  if (!existingAttempt) {
    const examType = await prisma.examType.findUnique({ where: { code: 'SAFE' } });
    const person = await prisma.person.upsert({
      where: { employeeCode: 'E100' },
      update: { fullName: 'Петров Пётр Петрович', position: 'Техник' },
      create: { fullName: 'Петров Пётр Петрович', position: 'Техник', employeeCode: 'E100' },
    });

    await prisma.examAttempt.create({
      data: {
        personId: person.id,
        examTypeId: examType!.id,
        attemptNo: 1,
        grade: 'gold',
        examDate: new Date(),
        status: 'draft',
        signerUserId: signerId,
        createdById: creatorId,
        templateVersionId: v1.id,
        notes: marker,
      },
    });
  }

  console.log('Seeded demo data. Public verify: GET /certs/outer/demo-public-id-12345');
  console.log(`Admin: ${adminEmail} / ${adminPassword}`);
  console.log(`Creator: ${creatorEmail} / ${creatorPassword}`);
  console.log(`Signer: ${signerEmail} / ${signerPassword}`);
  console.log(`User IDs: admin=${adminId} creator=${creatorId} signer=${signerId}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

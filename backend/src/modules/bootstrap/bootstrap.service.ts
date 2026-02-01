import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import * as bcrypt from 'bcryptjs';
import { PrismaService } from '../prisma/prisma.service';

type SeedUsers = {
  adminUserId: string;
  creatorUserId: string;
  signerUserId: string;
};

@Injectable()
export class BootstrapService implements OnModuleInit {
  private readonly logger = new Logger(BootstrapService.name);

  constructor(private readonly prisma: PrismaService) {}

  async onModuleInit() {
    const enabled = (process.env.DEV_BOOTSTRAP ?? 'true').toLowerCase() === 'true';
    if (!enabled) {
      this.logger.log('DEV_BOOTSTRAP is disabled');
      return;
    }

    const users = await this.bootstrapRbacAndUsers();
    await this.bootstrapExamTypes();
    await this.bootstrapDemoCertificate(users.adminUserId, users.signerUserId);
    await this.bootstrapDemoAttempt(users.creatorUserId, users.signerUserId);
  }

  private async ensurePermission(code: string, description?: string) {
    await this.prisma.permission.upsert({
      where: { code },
      update: { description: description ?? undefined },
      create: { code, description },
    });
  }

  private async ensureRoleWithPermissions(roleCode: string, roleName: string, permissionCodes: string[]) {
    const role = await this.prisma.role.upsert({
      where: { code: roleCode },
      update: { name: roleName },
      create: { code: roleCode, name: roleName },
    });

    const perms = await this.prisma.permission.findMany({
      where: { code: { in: permissionCodes } },
      select: { id: true },
    });

    for (const p of perms) {
      await this.prisma.rolePermission.upsert({
        where: { roleId_permissionId: { roleId: role.id, permissionId: p.id } },
        update: {},
        create: { roleId: role.id, permissionId: p.id },
      });
    }

    return role;
  }

  private async ensureUser(emailRaw: string, password: string, displayName: string, roleCodes: string[]) {
    const email = emailRaw.trim().toLowerCase();
    const existing = await this.prisma.appUser.findUnique({ where: { email } });

    let userId: string;
    if (!existing) {
      const passwordHash = await bcrypt.hash(password, 10);
      const user = await this.prisma.appUser.create({
        data: { email, passwordHash, displayName, isActive: true },
      });
      userId = user.id;
      this.logger.log(`Created user: ${email} (password: ${password})`);
    } else {
      await this.prisma.appUser.update({ where: { id: existing.id }, data: { isActive: true, displayName } });
      userId = existing.id;
      this.logger.log(`User exists: ${email}`);
    }

    for (const roleCode of roleCodes) {
      const role = await this.prisma.role.findUnique({ where: { code: roleCode } });
      if (!role) continue;
      await this.prisma.userRole.upsert({
        where: { userId_roleId: { userId, roleId: role.id } },
        update: {},
        create: { userId, roleId: role.id },
      });
    }

    return userId;
  }

  private async bootstrapRbacAndUsers(): Promise<SeedUsers> {
    // Permissions catalog (MVP + planned)
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

    for (const code of permissionCodes) {
      await this.ensurePermission(code);
    }

    // Roles
    await this.ensureRoleWithPermissions('admin', 'Admin', permissionCodes);
    await this.ensureRoleWithPermissions('creator', 'Creator', [
      'exam:create',
      'exam:edit_own',
      'exam:submit',
      'users:read',
      'certificate:view_internal',
    ]);
    await this.ensureRoleWithPermissions('signer', 'Signer', [
      'approval:review',
      'approval:approve',
      'approval:reject',
      'approval:bulk_action',
    ]);

    // Users (dev)
    const adminEmail = process.env.ADMIN_EMAIL || 'admin@example.com';
    const adminPassword = process.env.ADMIN_PASSWORD || 'admin123';

    const creatorEmail = process.env.CREATOR_EMAIL || 'creator@example.com';
    const creatorPassword = process.env.CREATOR_PASSWORD || 'creator123';

    const signerEmail = process.env.SIGNER_EMAIL || 'signer@example.com';
    const signerPassword = process.env.SIGNER_PASSWORD || 'signer123';

    const adminUserId = await this.ensureUser(adminEmail, adminPassword, 'Administrator', ['admin']);
    const creatorUserId = await this.ensureUser(creatorEmail, creatorPassword, 'Exam Creator', ['creator']);
    const signerUserId = await this.ensureUser(signerEmail, signerPassword, 'Exam Signer', ['signer']);

    return { adminUserId, creatorUserId, signerUserId };
  }

  private async bootstrapExamTypes() {
    await this.prisma.examType.upsert({
      where: { code: 'DEMO' },
      update: {
        defaultValidityType: 'perpetual' as any,
        defaultValidityMonths: 0,
      },
      create: { name: 'Demo Exam', code: 'DEMO', defaultValidityType: 'perpetual' as any, defaultValidityMonths: 0 },
    });
    await this.prisma.examType.upsert({
      where: { code: 'SAFE' },
      update: {
        defaultValidityType: 'duration' as any,
        defaultValidityMonths: 36,
      },
      create: { name: 'Safety Basics', code: 'SAFE', defaultValidityType: 'duration' as any, defaultValidityMonths: 36 },
    });
    await this.prisma.examType.upsert({
      where: { code: 'FAID' },
      update: {
        defaultValidityType: 'duration' as any,
        defaultValidityMonths: 24,
      },
      create: { name: 'First Aid', code: 'FAID', defaultValidityType: 'duration' as any, defaultValidityMonths: 24 },
    });

    this.logger.log('Exam types ensured: DEMO, SAFE, FAID');
  }

  private async bootstrapDemoCertificate(adminUserId: string, signerUserId: string) {
    const demoPublicId = 'demo-public-id-12345';
    const existing = await this.prisma.certificate.findUnique({ where: { publicId: demoPublicId } });
    if (existing) {
      this.logger.log('Demo certificate exists');
      return;
    }

    const examType = await this.prisma.examType.findUnique({ where: { code: 'DEMO' } });
    if (!examType) return;

    const person = await this.prisma.person.upsert({
      where: { employeeCode: 'DEMO-001' },
      update: { fullName: 'Иванов Иван Иванович', position: 'Инженер' },
      create: { fullName: 'Иванов Иван Иванович', position: 'Инженер', employeeCode: 'DEMO-001' },
    });

    const issuedAt = new Date();
    const year = issuedAt.getUTCFullYear();
    const certificateNumber = `${year}-DEMO-000001`;

    // Ensure counter so the next issued DEMO certificate will be 000002
    await this.prisma.certificateCounter.upsert({
      where: { examTypeId_year: { examTypeId: examType.id, year } },
      update: { seq: 1 },
      create: { examTypeId: examType.id, year, seq: 1 },
    });

    // Create an approved attempt for the demo certificate
    const attempt = await this.prisma.examAttempt.create({
      data: {
        personId: person.id,
        examTypeId: examType.id,
        attemptNo: 1,
        grade: 'gold' as any,
        examDate: issuedAt,
        status: 'approved' as any,
        signerUserId,
        createdById: adminUserId,
        notes: 'DEMO_CERT_ATTEMPT_V1',
      },
    });

    await this.prisma.certificate.create({
      data: {
        certificateNumber,
        publicId: demoPublicId,
        grade: 'gold' as any,
        status: 'issued' as any,
        issuedAt,
        validityType: examType.defaultValidityType as any,
        validityMonths: examType.defaultValidityType === 'duration' ? examType.defaultValidityMonths : null,
        validFrom: issuedAt,
        validTo: null,
        examAttemptId: attempt.id,
        renderSnapshotJson: {
          fullName: person.fullName,
          position: person.position,
          employeeCode: person.employeeCode,
          examTypeName: examType.name,
          examTypeCode: examType.code,
          grade: 'gold',
          certificateNumber,
          publicId: demoPublicId,
          issuedAt: issuedAt.toISOString(),
          validTo: null,
          validityType: examType.defaultValidityType,
          validityMonths: examType.defaultValidityType === 'duration' ? examType.defaultValidityMonths : null,
          signerName: null,
        },
      },
    });

    this.logger.log('Created demo certificate: /certs/outer/demo-public-id-12345');
  }

  private async bootstrapDemoAttempt(creatorUserId: string, signerUserId: string) {
    const marker = 'DEMO_ATTEMPT_V1';
    const existing = await this.prisma.examAttempt.findFirst({ where: { notes: marker } });
    if (existing) {
      this.logger.log('Demo attempt exists');
      return;
    }

    const examType = await this.prisma.examType.findUnique({ where: { code: 'SAFE' } });
    if (!examType) return;

    const person = await this.prisma.person.upsert({
      where: { employeeCode: 'E100' },
      update: { fullName: 'Петров Пётр Петрович', position: 'Техник' },
      create: { fullName: 'Петров Пётр Петрович', position: 'Техник', employeeCode: 'E100' },
    });

    await this.prisma.examAttempt.create({
      data: {
        personId: person.id,
        examTypeId: examType.id,
        attemptNo: 1,
        grade: 'gold',
        examDate: new Date(),
        status: 'draft',
        signerUserId,
        createdById: creatorUserId,
        notes: marker,
      },
    });

    this.logger.log('Created demo attempt for workflow (creator -> submit -> signer inbox)');
  }
}

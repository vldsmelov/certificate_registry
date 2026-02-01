import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import * as bcrypt from 'bcryptjs';
import { PrismaService } from '../prisma/prisma.service';

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

    await this.bootstrapRbac();
    await this.bootstrapDemoCertificate();
  }

  private async bootstrapRbac() {
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
      await this.prisma.permission.upsert({ where: { code }, update: {}, create: { code } });
    }

    const adminRole = await this.prisma.role.upsert({
      where: { code: 'admin' },
      update: {},
      create: { code: 'admin', name: 'Admin' },
    });

    const allPerms = await this.prisma.permission.findMany({ select: { id: true } });
    for (const p of allPerms) {
      await this.prisma.rolePermission.upsert({
        where: { roleId_permissionId: { roleId: adminRole.id, permissionId: p.id } },
        update: {},
        create: { roleId: adminRole.id, permissionId: p.id },
      });
    }

    const adminEmail = (process.env.ADMIN_EMAIL || 'admin@example.com').trim().toLowerCase();
    const adminPassword = process.env.ADMIN_PASSWORD || 'admin123';

    const existing = await this.prisma.appUser.findUnique({ where: { email: adminEmail } });
    if (!existing) {
      const passwordHash = await bcrypt.hash(adminPassword, 10);
      const user = await this.prisma.appUser.create({
        data: { email: adminEmail, passwordHash, displayName: 'Administrator', isActive: true },
      });
      await this.prisma.userRole.create({ data: { userId: user.id, roleId: adminRole.id } });
      this.logger.log(`Created default admin user: ${adminEmail} (password: ${adminPassword})`);
    } else {
      // Ensure user is active and has admin role
      await this.prisma.appUser.update({ where: { id: existing.id }, data: { isActive: true } });
      await this.prisma.userRole.upsert({
        where: { userId_roleId: { userId: existing.id, roleId: adminRole.id } },
        update: {},
        create: { userId: existing.id, roleId: adminRole.id },
      });
      this.logger.log(`Default admin user exists: ${adminEmail}`);
    }
  }

  private async bootstrapDemoCertificate() {
    const demoPublicId = 'demo-public-id-12345';
    const existing = await this.prisma.certificate.findUnique({ where: { publicId: demoPublicId } });
    if (existing) {
      this.logger.log('Demo certificate exists');
      return;
    }

    const examType = await this.prisma.examType.upsert({
      where: { code: 'DEMO' },
      update: {},
      create: { name: 'Demo Exam', code: 'DEMO' },
    });

    const person = await this.prisma.person.create({
      data: { fullName: 'Иванов Иван Иванович', position: 'Инженер' },
    });

    await this.prisma.certificate.create({
      data: {
        certificateNumber: '2026-DEMO-000001',
        publicId: demoPublicId,
        grade: 'gold',
        status: 'issued',
        issuedAt: new Date(),
        validFrom: new Date(),
        validTo: new Date(Date.now() + 1000 * 60 * 60 * 24 * 365),
        personId: person.id,
        examTypeId: examType.id,
        renderSnapshotJson: {
          fullName: person.fullName,
          position: person.position,
          examTypeName: examType.name,
          examTypeCode: examType.code,
          grade: 'gold',
          certificateNumber: '2026-DEMO-000001',
          publicId: demoPublicId,
        },
      },
    });

    this.logger.log('Created demo certificate: /certs/outer/demo-public-id-12345');
  }
}

import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CertificatesService } from '../certificates/certificates.service';

@Injectable()
export class ApprovalsService {
  constructor(private readonly prisma: PrismaService, private readonly certificates: CertificatesService) {}

  async inbox(signerUserId: string) {
    return this.prisma.approval.findMany({
      where: { signerUserId, status: 'pending' as any },
      orderBy: { createdAt: 'desc' },
      include: {
        examAttempt: {
          include: {
            person: { select: { fullName: true, position: true, employeeCode: true } },
            examType: { select: { name: true, code: true } },
            createdBy: { select: { id: true, email: true, displayName: true } },
          },
        },
      },
    });
  }

  async approve(approvalId: string, signerUserId: string) {
    return this.decide({ approvalId, signerUserId, action: 'approve' });
  }

  async reject(approvalId: string, signerUserId: string, reason: string | null) {
    return this.decide({ approvalId, signerUserId, action: 'reject', reason });
  }

  private async decide(opts: { approvalId: string; signerUserId: string; action: 'approve' | 'reject'; reason?: string | null }) {
    const approval = await this.prisma.approval.findUnique({ where: { id: opts.approvalId } });
    if (!approval) throw new NotFoundException('Approval not found');
    if (approval.signerUserId !== opts.signerUserId) throw new ForbiddenException('Not your approval');
    if (approval.status !== 'pending') throw new BadRequestException(`Approval is not pending (status=${approval.status})`);

    const now = new Date();
    const approvalStatus = opts.action === 'approve' ? ('approved' as const) : ('rejected' as const);
    const attemptStatus = opts.action === 'approve' ? ('approved' as const) : ('needs_fix' as const);

    return this.prisma.$transaction(async (tx) => {
      const updatedApproval = await tx.approval.update({
        where: { id: approval.id },
        data: { status: approvalStatus as any, decidedAt: now, reason: opts.reason ?? null },
      });

      const updatedAttempt = await tx.examAttempt.update({
        where: { id: approval.examAttemptId },
        data: { status: attemptStatus as any },
      });

      let issuedCertificate: any = null;
      if (opts.action === 'approve') {
        issuedCertificate = await this.certificates.issueForAttemptTx(tx as any, updatedAttempt.id, opts.signerUserId);
      }

      return { status: approvalStatus, approval: updatedApproval, attempt: updatedAttempt, certificate: issuedCertificate };
    });
  }

  async bulkDecide(opts: {
    signerUserId: string;
    action: 'approve' | 'reject';
    approvalIds: string[];
    reason?: string | null;
  }) {
    if (!Array.isArray(opts.approvalIds) || opts.approvalIds.length === 0) {
      throw new BadRequestException('approvalIds must be a non-empty array');
    }

    const now = new Date();
    const approvalStatus = opts.action === 'approve' ? ('approved' as const) : ('rejected' as const);
    const attemptStatus = opts.action === 'approve' ? ('approved' as const) : ('needs_fix' as const);

    // Find only approvals that belong to signer and are pending
    const approvals = await this.prisma.approval.findMany({
      where: {
        id: { in: opts.approvalIds },
        signerUserId: opts.signerUserId,
        status: 'pending' as any,
      },
      select: { id: true, examAttemptId: true },
    });

    const ids = approvals.map((a) => a.id);
    const attemptIds = approvals.map((a) => a.examAttemptId);

    if (ids.length === 0) {
      return { updated: 0, skipped: opts.approvalIds.length };
    }

    const res = await this.prisma.$transaction(async (tx) => {
      const updApprovals = await tx.approval.updateMany({
        where: { id: { in: ids } },
        data: { status: approvalStatus as any, decidedAt: now, reason: opts.reason ?? null },
      });

      const updAttempts = await tx.examAttempt.updateMany({
        where: { id: { in: attemptIds } },
        data: { status: attemptStatus as any },
      });

      let issued: any[] = [];
      if (opts.action === 'approve') {
        // Issue certificates for each approved attempt (idempotent)
        for (const attemptId of attemptIds) {
          const c = await this.certificates.issueForAttemptTx(tx as any, attemptId, opts.signerUserId);
          issued.push({ publicId: c.publicId, certificateNumber: c.certificateNumber });
        }
      }

      return { updApprovals, updAttempts, issued };
    });

    return {
      updated: res.updApprovals.count,
      skipped: opts.approvalIds.length - res.updApprovals.count,
      issued: res.issued ?? [],
    };
  }
}

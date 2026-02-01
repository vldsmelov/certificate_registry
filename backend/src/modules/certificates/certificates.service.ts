import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Prisma } from '@prisma/client';
import { randomUUID } from 'crypto';

type Tx = Prisma.TransactionClient;

function addMonths(date: Date, months: number): Date {
  const d = new Date(date.getTime());
  const day = d.getUTCDate();
  d.setUTCMonth(d.getUTCMonth() + months);
  // Handle month overflow (e.g., Jan 31 + 1 month)
  if (d.getUTCDate() < day) {
    d.setUTCDate(0);
  }
  return d;
}

@Injectable()
export class CertificatesService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Issue (create) a certificate for an approved attempt.
   * Idempotent: if certificate already exists for attempt, returns it.
   */
  async issueForAttemptTx(tx: Tx, attemptId: string, issuedByUserId: string) {
    const attempt = await tx.examAttempt.findUnique({
      where: { id: attemptId },
      include: {
        person: true,
        examType: true,
        signerUser: { select: { id: true, email: true, displayName: true } },
      },
    });
    if (!attempt) throw new NotFoundException('Attempt not found');
    if (attempt.status !== 'approved') throw new BadRequestException(`Attempt must be approved to issue certificate (status=${attempt.status})`);
    if (attempt.grade === 'fail') throw new BadRequestException('Failed attempt cannot have a certificate');

    const existing = await tx.certificate.findUnique({ where: { examAttemptId: attempt.id } });
    if (existing) return existing;

    const issuedAt = new Date();
    const year = issuedAt.getUTCFullYear();

    const counter = await tx.certificateCounter.upsert({
      where: { examTypeId_year: { examTypeId: attempt.examTypeId, year } },
      update: { seq: { increment: 1 } },
      create: { examTypeId: attempt.examTypeId, year, seq: 1 },
    });

    const seq6 = String(counter.seq).padStart(6, '0');
    const certificateNumber = `${year}-${attempt.examType.code}-${seq6}`;
    const publicId = randomUUID();

    // Validity
    const validityType = attempt.examType.defaultValidityType;
    const validityMonths = validityType === 'duration' ? attempt.examType.defaultValidityMonths : null;

    let validTo: Date | null = null;
    if (validityType === 'perpetual') {
      validTo = null;
    } else if (validityType === 'fixed_date') {
      validTo = attempt.examType.defaultValidTo ?? addMonths(issuedAt, attempt.examType.defaultValidityMonths);
    } else {
      validTo = addMonths(issuedAt, attempt.examType.defaultValidityMonths);
    }

    const signerName = attempt.signerUser?.displayName ?? attempt.signerUser?.email ?? null;

    const renderSnapshotJson = {
      fullName: attempt.person.fullName,
      position: attempt.person.position,
      employeeCode: attempt.person.employeeCode,
      examTypeName: attempt.examType.name,
      examTypeCode: attempt.examType.code,
      grade: attempt.grade,
      certificateNumber,
      publicId,
      issuedAt: issuedAt.toISOString(),
      validTo: validTo ? validTo.toISOString() : null,
      validityType,
      validityMonths,
      signerName,
      issuedByUserId,
    };

    return tx.certificate.create({
      data: {
        certificateNumber,
        publicId,
        grade: attempt.grade as any,
        status: 'issued',
        issuedAt,
        validityType: validityType as any,
        validityMonths,
        validFrom: issuedAt,
        validTo,
        renderSnapshotJson,
        examAttemptId: attempt.id,
      },
    });
  }

  async getPublicStatus(publicId: string) {
    const cert = await this.prisma.certificate.findUnique({
      where: { publicId },
      include: {
        examAttempt: {
          select: {
            examType: { select: { name: true, code: true } },
          },
        },
      },
    });

    if (!cert) {
      return { status: 'not_found' as const };
    }

    const now = new Date();
    const expired = cert.validTo ? now > cert.validTo : false;

    let status: 'valid' | 'expired' | 'revoked' | 'annulled' = 'valid';
    if (cert.status === 'revoked') status = 'revoked';
    else if (cert.status === 'annulled') status = 'annulled';
    else if (expired) status = 'expired';

    const snap: any = cert.renderSnapshotJson ?? {};

    return {
      status,
      certificateNumber: cert.certificateNumber,
      grade: cert.grade,
      issuedAt: cert.issuedAt,
      validityType: cert.validityType,
      validTo: cert.validTo,
      examType: {
        name: snap.examTypeName ?? cert.examAttempt?.examType?.name ?? null,
        code: snap.examTypeCode ?? cert.examAttempt?.examType?.code ?? null,
      },
      signerName: snap.signerName ?? null,
    };
  }

  async getInternalView(publicId: string) {
    const cert = await this.prisma.certificate.findUnique({
      where: { publicId },
      include: {
        examAttempt: {
          include: {
            person: true,
            examType: true,
            signerUser: { select: { id: true, email: true, displayName: true } },
            createdBy: { select: { id: true, email: true, displayName: true } },
          },
        },
        revokedBy: { select: { id: true, email: true, displayName: true } },
      },
    });

    if (!cert) return { status: 'not_found' as const };

    const now = new Date();
    const expired = cert.validTo ? now > cert.validTo : false;
    const snap: any = cert.renderSnapshotJson ?? {};

    return {
      status: 'ok' as const,
      certificate: {
        certificateNumber: cert.certificateNumber,
        publicId: cert.publicId,
        grade: cert.grade,
        status: cert.status,
        issuedAt: cert.issuedAt,
        validityType: cert.validityType,
        validityMonths: cert.validityMonths,
        validFrom: cert.validFrom,
        validTo: cert.validTo,
        expired,
        revokedAt: cert.revokedAt,
        revokeReason: cert.revokeReason,
        revokedBy: cert.revokedBy ? (cert.revokedBy.displayName ?? cert.revokedBy.email) : null,
        snapshot: snap,
      },
      attempt: cert.examAttempt
        ? {
            id: cert.examAttempt.id,
            status: cert.examAttempt.status,
            grade: cert.examAttempt.grade,
            examDate: cert.examAttempt.examDate,
            attemptNo: cert.examAttempt.attemptNo,
            person: {
              fullName: cert.examAttempt.person.fullName,
              position: cert.examAttempt.person.position,
              employeeCode: cert.examAttempt.person.employeeCode,
            },
            examType: { name: cert.examAttempt.examType.name, code: cert.examAttempt.examType.code },
            signer: cert.examAttempt.signerUser ? (cert.examAttempt.signerUser.displayName ?? cert.examAttempt.signerUser.email) : null,
            createdBy: cert.examAttempt.createdBy ? (cert.examAttempt.createdBy.displayName ?? cert.examAttempt.createdBy.email) : null,
          }
        : null,
    };
  }

  async setRevocation(publicId: string, actorUserId: string, status: 'revoked' | 'annulled', reason: string | null) {
    const cert = await this.prisma.certificate.findUnique({ where: { publicId } });
    if (!cert) throw new NotFoundException('Certificate not found');

    if (cert.status !== 'issued') {
      throw new BadRequestException(`Only issued certificates can be revoked/annulled (status=${cert.status})`);
    }

    return this.prisma.certificate.update({
      where: { publicId },
      data: {
        status: status as any,
        revokedAt: new Date(),
        revokedById: actorUserId,
        revokeReason: reason,
      },
    });
  }
}

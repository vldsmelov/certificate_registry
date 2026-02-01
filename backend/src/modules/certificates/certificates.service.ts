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

  async listInternal(params: {
    q?: string;
    status?: string;
    grade?: string;
    examTypeId?: string;
    signerUserId?: string;
    issuedFrom?: Date | null;
    issuedTo?: Date | null;
    examFrom?: Date | null;
    examTo?: Date | null;
    validity?: string;
    page: number;
    pageSize: number;
    forExport?: boolean;
  }) {
    const now = new Date();
    const {
      q,
      status,
      grade,
      examTypeId,
      signerUserId,
      issuedFrom,
      issuedTo,
      examFrom,
      examTo,
      validity,
      page,
      pageSize,
    } = params;

    const where: Prisma.CertificateWhereInput = {};
    const and: Prisma.CertificateWhereInput[] = [];

    // Grade
    if (grade && ['gold', 'silver', 'fail'].includes(grade)) {
      where.grade = grade as any;
    }

    // Status / validity
    const wantsExpired = (status === 'expired') || (validity === 'expired');
    const wantsActive = validity === 'active';

    if (status && ['issued', 'pending', 'revoked', 'annulled'].includes(status)) {
      where.status = status as any;
    }

    if (wantsExpired) {
      // Expired is a computed status: issued + validTo < now
      where.status = 'issued' as any;
      where.validTo = { lt: now };
    } else if (wantsActive) {
      // Active: issued + (validTo is null OR validTo >= now)
      where.status = 'issued' as any;
      and.push({ OR: [{ validTo: null }, { validTo: { gte: now } }] });
    }

    // Dates
    if (issuedFrom || issuedTo) {
      where.issuedAt = {
        ...(issuedFrom ? { gte: issuedFrom } : {}),
        ...(issuedTo ? { lte: issuedTo } : {}),
      };
    }

    // Relations filters
    const attemptWhere: Prisma.ExamAttemptWhereInput = {};
    if (examTypeId) attemptWhere.examTypeId = examTypeId;
    if (signerUserId) attemptWhere.signerUserId = signerUserId;
    if (examFrom || examTo) {
      attemptWhere.examDate = {
        ...(examFrom ? { gte: examFrom } : {}),
        ...(examTo ? { lte: examTo } : {}),
      };
    }

    if (Object.keys(attemptWhere).length > 0) {
      where.examAttempt = { is: attemptWhere };
    }

    // Search
    const qNorm = (q ?? '').trim();
    if (qNorm) {
      and.push({
        OR: [
          { certificateNumber: { contains: qNorm, mode: 'insensitive' } },
          { publicId: { contains: qNorm, mode: 'insensitive' } },
          {
            examAttempt: {
              is: {
                person: {
                  is: {
                    OR: [
                      { fullName: { contains: qNorm, mode: 'insensitive' } },
                      { position: { contains: qNorm, mode: 'insensitive' } },
                      { employeeCode: { contains: qNorm, mode: 'insensitive' } },
                    ],
                  },
                },
              },
            },
          },
        ],
      });
    }

    if (and.length > 0) {
      where.AND = and;
    }

    const skip = (page - 1) * pageSize;

    const [total, rows] = await this.prisma.$transaction([
      this.prisma.certificate.count({ where }),
      this.prisma.certificate.findMany({
        where,
        orderBy: [{ issuedAt: 'desc' }, { createdAt: 'desc' }],
        skip,
        take: pageSize,
        include: {
          examAttempt: {
            include: {
              person: true,
              examType: true,
              signerUser: { select: { id: true, email: true, displayName: true } },
            },
          },
        },
      }),
    ]);

    const items = rows.map((c) => {
      const expired = c.validTo ? now > c.validTo : false;
      const signerName = c.examAttempt.signerUser ? (c.examAttempt.signerUser.displayName ?? c.examAttempt.signerUser.email) : null;
      return {
        certificateNumber: c.certificateNumber,
        publicId: c.publicId,
        grade: c.grade,
        status: c.status,
        issuedAt: c.issuedAt,
        validTo: c.validTo,
        expired,
        revokedAt: c.revokedAt,
        revokeReason: c.revokeReason,
        person: {
          fullName: c.examAttempt.person.fullName,
          position: c.examAttempt.person.position,
          employeeCode: c.examAttempt.person.employeeCode,
        },
        examType: {
          id: c.examAttempt.examType.id,
          name: c.examAttempt.examType.name,
          code: c.examAttempt.examType.code,
        },
        examDate: c.examAttempt.examDate,
        attemptNo: c.examAttempt.attemptNo,
        signerName,
      };
    });

    return {
      page,
      pageSize,
      total,
      items,
    };
  }

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
    if (existing) {
      // Revision flow: certificate exists but was moved back to pending after edits.
      // When signer approves again, we simply mark it as issued (keeping number/publicId).
      if (existing.status === ('pending' as any)) {
        return tx.certificate.update({
          where: { id: existing.id },
          data: { status: 'issued' as any },
        });
      }
      return existing;
    }

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

    const templateVersionId = attempt.templateVersionId ?? attempt.examType.defaultTemplateVersionId ?? null;

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
      templateVersionId,
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
        templateVersionId: templateVersionId ?? undefined,
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

    let status: 'valid' | 'expired' | 'revoked' | 'annulled' | 'pending' = 'valid';
    if (cert.status === 'pending') status = 'pending';
    else if (cert.status === 'revoked') status = 'revoked';
    else if (cert.status === 'annulled') status = 'annulled';
    else if (expired) status = 'expired';

    const snap: any = cert.renderSnapshotJson ?? {};

    return {
      status,
      message: status === 'pending' ? 'в процессе согласования' : undefined,
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

  /**
   * Edit an already issued certificate and send it for re-signing.
   * Keeps the certificateNumber + publicId, but moves status back to `pending`.
   */
  async editAndResubmit(publicId: string, actorUserId: string, payload: {
    fullName?: string;
    position?: string;
    employeeCode?: string | null;
    validityType?: 'fixed_date' | 'duration' | 'perpetual';
    validityMonths?: number | null;
    validTo?: string | null;
    templateVersionId?: string | null;
    note?: string | null;
  }) {
    const cert = await this.prisma.certificate.findUnique({
      where: { publicId },
      include: {
        examAttempt: { include: { person: true, examType: true, signerUser: true } },
      },
    });
    if (!cert) throw new NotFoundException('Certificate not found');

    if (!['issued', 'pending'].includes(String(cert.status))) {
      throw new BadRequestException(`Only issued/pending certificates can be edited (status=${cert.status})`);
    }
    if (!cert.examAttempt?.signerUserId) {
      throw new BadRequestException('Certificate has no signer assigned');
    }

    const now = new Date();
    const validityType = (payload.validityType ?? cert.validityType) as any;
    let validityMonths: number | null = payload.validityMonths ?? (cert.validityMonths as any) ?? null;
    let validTo: Date | null = cert.validTo as any;

    if (validityType === 'perpetual') {
      validityMonths = null;
      validTo = null;
    } else if (validityType === 'duration') {
      if (!validityMonths || validityMonths <= 0) {
        throw new BadRequestException('validityMonths must be provided for duration validity');
      }
      // Keep existing validTo unless explicitly provided
      if (payload.validTo) {
        const d = new Date(payload.validTo);
        if (Number.isNaN(d.getTime())) throw new BadRequestException('validTo is invalid date');
        validTo = d;
      }
    } else if (validityType === 'fixed_date') {
      if (!payload.validTo) throw new BadRequestException('validTo must be provided for fixed_date validity');
      const d = new Date(payload.validTo);
      if (Number.isNaN(d.getTime())) throw new BadRequestException('validTo is invalid date');
      validityMonths = null;
      validTo = d;
    }

    const templateVersionId = payload.templateVersionId ?? cert.templateVersionId ?? null;
    const note = (payload.note ?? '').trim() || null;

    // Update render snapshot (used for deterministic internal PDF)
    const snap: any = cert.renderSnapshotJson ?? {};
    const nextSnap = {
      ...snap,
      fullName: payload.fullName ?? cert.examAttempt.person.fullName,
      position: payload.position ?? cert.examAttempt.person.position,
      employeeCode: payload.employeeCode === undefined ? cert.examAttempt.person.employeeCode : payload.employeeCode,
      validityType,
      validityMonths,
      validTo: validTo ? validTo.toISOString() : null,
      templateVersionId,
      editedAt: now.toISOString(),
      editedByUserId: actorUserId,
      editNote: note,
    };

    return this.prisma.$transaction(async (tx) => {
      // Update person data
      await tx.person.update({
        where: { id: cert.examAttempt.personId },
        data: {
          fullName: payload.fullName ?? cert.examAttempt.person.fullName,
          position: payload.position ?? cert.examAttempt.person.position,
          employeeCode: payload.employeeCode === undefined ? cert.examAttempt.person.employeeCode : payload.employeeCode,
        },
      });

      // Update attempt template (if changed) and move back to submitted
      await tx.examAttempt.update({
        where: { id: cert.examAttemptId },
        data: {
          status: 'submitted' as any,
          templateVersionId: templateVersionId ?? undefined,
        },
      });

      // Close existing pending approvals (avoid duplicates)
      await tx.approval.updateMany({
        where: { examAttemptId: cert.examAttemptId, status: 'pending' as any },
        data: { status: 'rejected' as any, decidedAt: now, reason: 'superseded by edit' },
      });

      // Move certificate back to pending and store revision metadata
      const updatedCert = await tx.certificate.update({
        where: { id: cert.id },
        data: {
          status: 'pending' as any,
          validityType: validityType as any,
          validityMonths,
          validTo,
          templateVersionId: templateVersionId ?? undefined,
          renderSnapshotJson: nextSnap as any,
          editedAt: now,
          editedById: actorUserId,
          editNote: note,
        },
      });

      const signerUserId = cert.examAttempt.signerUserId;
      if (!signerUserId) {
        throw new BadRequestException('Signer is not set for this attempt');
      }

      // Create a new approval for signer
      const approval = await tx.approval.create({
        data: {
          examAttemptId: cert.examAttemptId,
          signerUserId: signerUserId,
          status: 'pending' as any,
          isRevision: true,
          note: note ?? 'Внесены изменения',
        },
      });

      return { status: 'ok' as const, certificate: updatedCert, approvalId: approval.id };
    });
  }

  async getInternalView(publicId: string) {
    const cert = await this.prisma.certificate.findUnique({
      where: { publicId },
      include: {
        templateVersion: {
          include: {
            template: true,
          },
        },
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
        template: cert.templateVersion ? { name: cert.templateVersion.template.name, version: cert.templateVersion.version } : null,
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

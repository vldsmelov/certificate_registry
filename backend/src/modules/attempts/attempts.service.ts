import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

export type CreateAttemptInput = {
  createdById: string;
  person: { fullName: string; position: string; employeeCode: string | null };
  examTypeId: string;
  grade: 'gold' | 'silver' | 'fail';
  examDate: Date;
  signerUserId: string | null;
  notes: string | null;
};

@Injectable()
export class AttemptsService {
  constructor(private readonly prisma: PrismaService) {}

  async listMine(userId: string) {
    return this.prisma.examAttempt.findMany({
      where: { createdById: userId },
      orderBy: { createdAt: 'desc' },
      include: {
        person: { select: { fullName: true, position: true, employeeCode: true } },
        examType: { select: { id: true, name: true, code: true } },
        signerUser: { select: { id: true, email: true, displayName: true } },
        approvals: { orderBy: { createdAt: 'desc' } },
        certificate: { select: { publicId: true, certificateNumber: true, status: true, validTo: true } },
      },
    });
  }

  async createAttempt(input: CreateAttemptInput) {
    const examType = await this.prisma.examType.findUnique({ where: { id: input.examTypeId } });
    if (!examType) throw new BadRequestException('Exam type not found');

    const person = input.person.employeeCode
      ? await this.prisma.person.upsert({
          where: { employeeCode: input.person.employeeCode },
          update: { fullName: input.person.fullName, position: input.person.position },
          create: {
            fullName: input.person.fullName,
            position: input.person.position,
            employeeCode: input.person.employeeCode,
          },
        })
      : await this.prisma.person.create({
          data: {
            fullName: input.person.fullName,
            position: input.person.position,
            employeeCode: null,
          },
        });

    // Compute attemptNo (best-effort for prototype). Later we can make it transactional.
    const attemptNo =
      (await this.prisma.examAttempt.count({
        where: { personId: person.id, examTypeId: input.examTypeId },
      })) + 1;

    const status = input.grade === 'fail' ? ('failed' as const) : ('draft' as const);

    return this.prisma.examAttempt.create({
      data: {
        personId: person.id,
        examTypeId: input.examTypeId,
        attemptNo,
        grade: input.grade as any,
        examDate: input.examDate,
        status: status as any,
        signerUserId: input.signerUserId,
        createdById: input.createdById,
        notes: input.notes,
      },
      include: {
        person: { select: { fullName: true, position: true, employeeCode: true } },
        examType: { select: { id: true, name: true, code: true } },
        signerUser: { select: { id: true, email: true, displayName: true } },
      },
    });
  }

  async submitAttempt(opts: { attemptId: string; userId: string }) {
    const attempt = await this.prisma.examAttempt.findUnique({
      where: { id: opts.attemptId },
      include: { approvals: true },
    });
    if (!attempt) throw new NotFoundException('Attempt not found');
    if (attempt.createdById !== opts.userId) throw new ForbiddenException('Only creator can submit this attempt');
    if (!['draft', 'needs_fix'].includes(attempt.status)) {
      throw new BadRequestException(`Attempt cannot be submitted from status=${attempt.status}`);
    }
    if (attempt.grade === 'fail') throw new BadRequestException('Failed attempt cannot be submitted');
    if (!attempt.signerUserId) throw new BadRequestException('signerUserId is required to submit');

    const existingPending = attempt.approvals.find((a) => a.status === 'pending');
    if (existingPending) return { status: 'already_pending', approvalId: existingPending.id };

    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.examAttempt.update({
        where: { id: attempt.id },
        data: { status: 'submitted' as any },
      });
      const approval = await tx.approval.create({
        data: {
          examAttemptId: attempt.id,
          signerUserId: attempt.signerUserId!,
          status: 'pending' as any,
        },
      });
      return { status: 'submitted', attempt: updated, approval };
    });
  }
}

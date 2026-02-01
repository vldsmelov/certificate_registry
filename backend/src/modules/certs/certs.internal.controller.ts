import { Controller, Get, Param, HttpException, HttpStatus } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Controller()
export class CertsInternalController {
  constructor(private readonly prisma: PrismaService) {}

  // Internal contour: full view (later: auth + RBAC)
  @Get('/certs/inner/:publicId')
  async innerView(@Param('publicId') publicId: string) {
    const cert = await this.prisma.certificate.findUnique({
      where: { publicId },
      include: { person: true, examType: true },
    });
    if (!cert) return { status: 'not_found' };

    return {
      status: 'ok',
      certificateNumber: cert.certificateNumber,
      grade: cert.grade,
      issuedAt: cert.issuedAt,
      validTo: cert.validTo,
      person: cert.person ? { fullName: cert.person.fullName, position: cert.person.position } : null,
      examType: cert.examType ? { name: cert.examType.name, code: cert.examType.code } : null,
    };
  }

  // Internal PDF: on-demand generation (placeholder in scaffold)
  @Get('/api/internal/certs/:publicId/pdf')
  async pdf(@Param('publicId') _publicId: string) {
    throw new HttpException(
      'PDF generation is not implemented in scaffold. Will be added in a later iteration.',
      HttpStatus.NOT_IMPLEMENTED,
    );
  }
}

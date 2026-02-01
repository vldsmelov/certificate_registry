import { Controller, Get, Param, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Controller('/certs')
export class CertsPublicController {
  constructor(private readonly prisma: PrismaService) {}

  // External contour: no auth, no personal data
  @Get('/outer/:publicId')
  async outerVerify(@Param('publicId') publicId: string) {
    const cert = await this.prisma.certificate.findUnique({ where: { publicId } });

    if (!cert) {
      throw new NotFoundException('Certificate not found');
    }

    const now = new Date();
    const expired = cert.validTo ? now > cert.validTo : false;

    let status: 'valid' | 'expired' | 'revoked' | 'annulled' = 'valid';
    if (cert.status === 'revoked') status = 'revoked';
    else if (cert.status === 'annulled') status = 'annulled';
    else if (expired) status = 'expired';

    return {
      status,
      certificateNumber: cert.certificateNumber,
      grade: cert.grade,
      issuedAt: cert.issuedAt,
      validTo: cert.validTo,
      // IMPORTANT: no personal data here
    };
  }
}

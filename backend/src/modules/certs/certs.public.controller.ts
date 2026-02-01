import { Controller, Get, Param } from '@nestjs/common';
import { CertificatesService } from '../certificates/certificates.service';

@Controller('/certs')
export class CertsPublicController {
  constructor(private readonly certificates: CertificatesService) {}

  // External contour: no auth, no personal data
  @Get('/outer/:publicId')
  async outerVerify(@Param('publicId') publicId: string) {
    // Always return 200 with status field (easier for external verification UI)
    return this.certificates.getPublicStatus(publicId);
  }
}

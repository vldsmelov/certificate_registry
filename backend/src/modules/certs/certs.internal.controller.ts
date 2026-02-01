import { Body, Controller, Get, Param, Post, HttpException, HttpStatus, UseGuards, Req } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { PermissionsGuard } from '../rbac/permissions.guard';
import { RequirePermissions } from '../rbac/permissions.decorator';
import { CertificatesService } from '../certificates/certificates.service';

@Controller()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@RequirePermissions('certificate:view_internal')
export class CertsInternalController {
  constructor(private readonly certificates: CertificatesService) {}

  // Internal contour: full view (later: auth + RBAC)
  @Get('/certs/inner/:publicId')
  async innerView(@Param('publicId') publicId: string) {
    return this.certificates.getInternalView(publicId);
  }

  @Post('/api/internal/certs/:publicId/revoke')
  @RequirePermissions('certificate:revoke')
  async revoke(@Param('publicId') publicId: string, @Req() req: any, @Body() body: { reason?: string | null }) {
    const userId = req.user?.id;
    return this.certificates.setRevocation(publicId, userId, 'revoked', body?.reason ?? null);
  }

  @Post('/api/internal/certs/:publicId/annul')
  @RequirePermissions('certificate:revoke')
  async annul(@Param('publicId') publicId: string, @Req() req: any, @Body() body: { reason?: string | null }) {
    const userId = req.user?.id;
    return this.certificates.setRevocation(publicId, userId, 'annulled', body?.reason ?? null);
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

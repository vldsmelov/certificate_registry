import { Body, Controller, Get, Param, Post, Patch, UseGuards, Req, Res, InternalServerErrorException } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { PermissionsGuard } from '../rbac/permissions.guard';
import { RequirePermissions } from '../rbac/permissions.decorator';
import { CertificatesService } from '../certificates/certificates.service';
import { PdfRendererService } from '../certificates/pdf-renderer.service';
import { Response } from 'express';

@Controller()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@RequirePermissions('certificate:view_internal')
export class CertsInternalController {
  constructor(
    private readonly certificates: CertificatesService,
    private readonly renderer: PdfRendererService,
  ) {}

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

  // Edit certificate + send for re-signing (revision flow)
  @Patch('/api/internal/certs/:publicId')
  @RequirePermissions('certificate:edit')
  async editAndResubmit(
    @Param('publicId') publicId: string,
    @Req() req: any,
    @Body() body: {
      fullName?: string;
      position?: string;
      employeeCode?: string | null;
      validityType?: 'fixed_date' | 'duration' | 'perpetual';
      validityMonths?: number | null;
      validTo?: string | null;
      templateVersionId?: string | null;
      note?: string | null;
    },
  ) {
    const userId = req.user?.id;
    return this.certificates.editAndResubmit(publicId, userId, body);
  }

  // Internal PDF: on-demand generation (no storage)
  @Get('/api/internal/certs/:publicId/pdf')
  async pdf(@Param('publicId') publicId: string, @Res() res: Response) {
    try {
      const { buffer, filename } = await this.renderer.renderCertificatePdf(publicId);

      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `inline; filename="${filename}"`);
      res.send(buffer);
    } catch (e: any) {
      const isDev = (process.env.NODE_ENV || 'development') !== 'production';
      const detail = isDev ? (e?.message ?? String(e)) : undefined;
      throw new InternalServerErrorException({ message: 'PDF render failed', detail });
    }
  }
}
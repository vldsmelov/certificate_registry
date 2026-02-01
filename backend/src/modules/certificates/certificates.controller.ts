import {
  Controller,
  Get,
  Query,
  Res,
  Req,
  UseGuards,
  BadRequestException,
} from '@nestjs/common';
import { Response } from 'express';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { PermissionsGuard } from '../rbac/permissions.guard';
import { RequirePermissions } from '../rbac/permissions.decorator';
import { CertificatesService } from './certificates.service';

function parseIntSafe(v: any, def: number) {
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : def;
}

function parseDateSafe(v: any): Date | null {
  if (!v) return null;
  const d = new Date(String(v));
  return Number.isNaN(d.getTime()) ? null : d;
}

function csvEscape(val: any): string {
  if (val === null || val === undefined) return '';
  const s = String(val);
  if (/[",\n\r]/.test(s)) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

@Controller('/api/internal/certificates')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class CertificatesController {
  constructor(private readonly certificates: CertificatesService) {}

  @Get()
  @RequirePermissions('certificate:view_internal')
  async list(
    @Query('q') q?: string,
    @Query('status') status?: string,
    @Query('grade') grade?: string,
    @Query('examTypeId') examTypeId?: string,
    @Query('signerUserId') signerUserId?: string,
    @Query('issuedFrom') issuedFromRaw?: string,
    @Query('issuedTo') issuedToRaw?: string,
    @Query('examFrom') examFromRaw?: string,
    @Query('examTo') examToRaw?: string,
    @Query('validity') validity?: string,
    @Query('page') pageRaw?: string,
    @Query('pageSize') pageSizeRaw?: string,
  ) {
    const page = parseIntSafe(pageRaw, 1);
    const pageSize = Math.min(parseIntSafe(pageSizeRaw, 20), 200);

    const issuedFrom = parseDateSafe(issuedFromRaw);
    const issuedTo = parseDateSafe(issuedToRaw);
    const examFrom = parseDateSafe(examFromRaw);
    const examTo = parseDateSafe(examToRaw);

    return this.certificates.listInternal({
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
    });
  }

  @Get('/export.csv')
  @RequirePermissions('export:run')
  async exportCsv(
    @Res() res: Response,
    @Req() _req: any,
    @Query('q') q?: string,
    @Query('status') status?: string,
    @Query('grade') grade?: string,
    @Query('examTypeId') examTypeId?: string,
    @Query('signerUserId') signerUserId?: string,
    @Query('issuedFrom') issuedFromRaw?: string,
    @Query('issuedTo') issuedToRaw?: string,
    @Query('examFrom') examFromRaw?: string,
    @Query('examTo') examToRaw?: string,
    @Query('validity') validity?: string,
  ) {
    const issuedFrom = parseDateSafe(issuedFromRaw);
    const issuedTo = parseDateSafe(issuedToRaw);
    const examFrom = parseDateSafe(examFromRaw);
    const examTo = parseDateSafe(examToRaw);

    const { items, total } = await this.certificates.listInternal({
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
      page: 1,
      pageSize: 5000,
      forExport: true,
    });

    if (total > 5000) {
      throw new BadRequestException('Too many rows for CSV export (limit 5000). Narrow filters.');
    }

    const bom = '\ufeff'; // helps Excel with UTF-8
    const header = [
      'certificate_number',
      'public_id',
      'status',
      'grade',
      'issued_at',
      'valid_to',
      'expired',
      'exam_type_code',
      'exam_type_name',
      'exam_date',
      'attempt_no',
      'full_name',
      'position',
      'employee_code',
      'signer',
      'revoked_at',
      'revoke_reason',
    ];

    const lines: string[] = [];
    lines.push(header.join(','));
    for (const it of items as any[]) {
      lines.push(
        [
          it.certificateNumber,
          it.publicId,
          it.status,
          it.grade,
          it.issuedAt,
          it.validTo ?? '',
          it.expired ? 'true' : 'false',
          it.examType?.code ?? '',
          it.examType?.name ?? '',
          it.examDate ?? '',
          it.attemptNo ?? '',
          it.person?.fullName ?? '',
          it.person?.position ?? '',
          it.person?.employeeCode ?? '',
          it.signerName ?? '',
          it.revokedAt ?? '',
          it.revokeReason ?? '',
        ].map(csvEscape).join(',')
      );
    }

    const today = new Date();
    const y = today.getUTCFullYear();
    const m = String(today.getUTCMonth() + 1).padStart(2, '0');
    const d = String(today.getUTCDate()).padStart(2, '0');
    const filename = `certificates_${y}${m}${d}.csv`;

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(bom + lines.join('\n'));
  }
}

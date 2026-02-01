import { Injectable, NotFoundException, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { PDFDocument, StandardFonts } from 'pdf-lib';
// NOTE: This repo compiles without `esModuleInterop`.
// In that setup, `import fontkit from '@pdf-lib/fontkit'` resolves to `require(...).default`
// which is undefined for CommonJS exports. We therefore require the module and fall back to `.default`.
// eslint-disable-next-line @typescript-eslint/no-var-requires
const fontkitModule: any = require('@pdf-lib/fontkit');
const fontkit: any = fontkitModule?.default ?? fontkitModule;
import { promises as fs } from 'fs';
import { join } from 'path';
import * as QRCode from 'qrcode';

type FieldCfg = { x: number; y: number; size?: number };

type TemplateCfg = {
  page?: { orientation?: 'landscape' | 'portrait' };
  fields?: Record<string, FieldCfg>;
};

function mergeCfg(base: TemplateCfg, override: any): TemplateCfg {
  const o: TemplateCfg = typeof override === 'object' && override ? override : {};
  return {
    page: { ...base.page, ...(o.page ?? {}) },
    fields: { ...(base.fields ?? {}), ...(o.fields ?? {}) },
  };
}

function fmtDate(d: Date | string | null | undefined): string {
  if (!d) return '';
  const dt = typeof d === 'string' ? new Date(d) : d;
  const yyyy = dt.getUTCFullYear();
  const mm = String(dt.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(dt.getUTCDate()).padStart(2, '0');
  return `${dd}.${mm}.${yyyy}`;
}

@Injectable()
export class PdfRendererService {
  private readonly logger = new Logger(PdfRendererService.name);

  constructor(private readonly prisma: PrismaService) {}

  private storageRoot() {
    return process.env.TEMPLATE_STORAGE_DIR || '/app/data/templates';
  }

  private async loadFont(pdf: PDFDocument) {
    const candidates = [
      process.env.PDF_FONT_PATH,
      '/app/assets/fonts/DejaVuSans.ttf',
      '/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf',
    ].filter(Boolean) as string[];

    for (const path of candidates) {
      try {
        const bytes = await fs.readFile(path);
        return pdf.embedFont(bytes, { subset: true });
      } catch (e: any) {
        this.logger.warn(`Could not load font at ${path}: ${e?.message ?? e}`);
      }
    }

    this.logger.warn('Falling back to StandardFonts.Helvetica (Cyrillic may not render)');
    return pdf.embedFont(StandardFonts.Helvetica);
  }

  private defaultCfg(): TemplateCfg {
    return {
      page: { orientation: 'landscape' },
      fields: {
        title: { x: 60, y: 530, size: 28 },
        fullName: { x: 60, y: 430, size: 22 },
        position: { x: 60, y: 390, size: 14 },
        examTypeName: { x: 60, y: 360, size: 14 },
        grade: { x: 60, y: 330, size: 14 },
        certificateNumber: { x: 60, y: 300, size: 14 },
        issuedAt: { x: 60, y: 270, size: 12 },
        validTo: { x: 60, y: 245, size: 12 },
        signerName: { x: 60, y: 200, size: 12 },
        qr: { x: 670, y: 155, size: 150 },
        verifyUrl: { x: 60, y: 120, size: 10 },
      },
    };
  }

  async renderCertificatePdf(publicId: string): Promise<{ buffer: Buffer; filename: string }> {
    const cert = await this.prisma.certificate.findUnique({
      where: { publicId },
      include: {
        templateVersion: { include: { template: true } },
        examAttempt: {
          include: {
            person: true,
            examType: true,
            signerUser: { select: { email: true, displayName: true } },
          },
        },
      },
    });

    if (!cert) throw new NotFoundException('Certificate not found');
    try {

    const snap: any = cert.renderSnapshotJson ?? {};
    const verifyBase = process.env.PUBLIC_VERIFY_BASE_URL || 'http://localhost:3000';
    const verifyUrl = `${verifyBase}/certs/outer/${cert.publicId}`;

    const cfg = mergeCfg(this.defaultCfg(), cert.templateVersion?.configJson);

    const landscape = (cfg.page?.orientation ?? 'landscape') === 'landscape';
    const pageSize: [number, number] = landscape ? [842, 595] : [595, 842];

    const pdf = await PDFDocument.create();
    pdf.registerFontkit(fontkit);
    const page = pdf.addPage(pageSize);
    const font = await this.loadFont(pdf);

    // Background
    const bgRel = cert.templateVersion?.backgroundPath;
    if (bgRel) {
      try {
        const abs = join(this.storageRoot(), bgRel);
        const bytes = await fs.readFile(abs);
        let img: any;
        if (bgRel.toLowerCase().endsWith('.png')) img = await pdf.embedPng(bytes);
        else img = await pdf.embedJpg(bytes);
        const { width, height } = page.getSize();
        page.drawImage(img, { x: 0, y: 0, width, height });
      } catch {
        // ignore missing background
      }
    }

    const draw = (key: string, text: string) => {
      const f = cfg.fields?.[key];
      if (!f) return;
      page.drawText(text, { x: f.x, y: f.y, size: f.size ?? 12, font });
    };

    draw('title', snap.title ?? 'СЕРТИФИКАТ');
    draw('fullName', `ФИО: ${snap.fullName ?? cert.examAttempt?.person?.fullName ?? ''}`);
    draw('position', `Должность: ${snap.position ?? cert.examAttempt?.person?.position ?? ''}`);
    draw('examTypeName', `Экзамен: ${snap.examTypeName ?? cert.examAttempt?.examType?.name ?? ''}`);
    draw('grade', `Оценка: ${(snap.grade ?? cert.grade ?? '').toString().toUpperCase()}`);
    draw('certificateNumber', `Номер: ${cert.certificateNumber}`);
    draw('issuedAt', `Выдан: ${fmtDate(cert.issuedAt)}`);
    draw('validTo', cert.validTo ? `Действителен до: ${fmtDate(cert.validTo)}` : 'Действителен: бессрочно');
    draw('signerName', `Подписант: ${snap.signerName ?? cert.examAttempt?.signerUser?.displayName ?? cert.examAttempt?.signerUser?.email ?? ''}`);
    draw('verifyUrl', `Проверка: ${verifyUrl}`);

    // QR
    const qrField = cfg.fields?.['qr'];
    if (qrField) {
      const qrPng = await QRCode.toBuffer(verifyUrl, { type: 'png', margin: 1, width: 256 });
      const qrImg = await pdf.embedPng(qrPng);
      const size = qrField.size ?? 140;
      page.drawImage(qrImg, { x: qrField.x, y: qrField.y, width: size, height: size });
    }

    const bytes = await pdf.save();
    const filename = `${cert.certificateNumber}.pdf`;
    return { buffer: Buffer.from(bytes), filename };
    } catch (e: any) {
      this.logger.error(`PDF render failed for ${publicId}: ${e?.message ?? e}`, e?.stack);
      throw e;
    }

  }
}

import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';
import QRCode from 'qrcode';
import { RenderSnapshotSchema, TemplateConfigSchema } from '@cert-registry/domain';

export type RenderInput = {
  snapshot: unknown;
  templateConfig: unknown;
  backgroundBytes?: Uint8Array | null;
  publicUrl: string;
};

export async function renderCertificatePdf({
  snapshot,
  templateConfig,
  backgroundBytes,
  publicUrl
}: RenderInput): Promise<Uint8Array> {
  const parsedSnapshot = RenderSnapshotSchema.parse(snapshot);
  const parsedConfig = TemplateConfigSchema.parse(templateConfig);

  const pdfDoc = await PDFDocument.create();
  const page = pdfDoc.addPage([parsedConfig.page.width, parsedConfig.page.height]);

  if (backgroundBytes) {
    const background = await pdfDoc.embedPng(backgroundBytes);
    page.drawImage(background, {
      x: 0,
      y: 0,
      width: parsedConfig.page.width,
      height: parsedConfig.page.height
    });
  }

  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);

  parsedConfig.fields.forEach((field) => {
    const value = (parsedSnapshot as Record<string, string | null>)[field.key] ?? '';
    page.drawText(String(value), {
      x: field.x,
      y: field.y,
      size: field.fontSize ?? 14,
      font,
      color: rgb(...hexToRgb(field.fontColor ?? '#1e293b'))
    });
  });

  const qrPng = await QRCode.toBuffer(publicUrl, { width: parsedConfig.qr.size });
  const qrImage = await pdfDoc.embedPng(qrPng);
  page.drawImage(qrImage, {
    x: parsedConfig.qr.x,
    y: parsedConfig.qr.y,
    width: parsedConfig.qr.size,
    height: parsedConfig.qr.size
  });

  return pdfDoc.save();
}

function hexToRgb(hex: string): [number, number, number] {
  const sanitized = hex.replace('#', '');
  const bigint = parseInt(sanitized, 16);
  const r = (bigint >> 16) & 255;
  const g = (bigint >> 8) & 255;
  const b = bigint & 255;
  return [r / 255, g / 255, b / 255];
}

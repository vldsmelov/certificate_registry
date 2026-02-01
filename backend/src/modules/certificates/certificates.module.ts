import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { CertificatesService } from './certificates.service';
import { PdfRendererService } from './pdf-renderer.service';

@Module({
  imports: [PrismaModule],
  providers: [CertificatesService, PdfRendererService],
  exports: [CertificatesService, PdfRendererService],
})
export class CertificatesModule {}

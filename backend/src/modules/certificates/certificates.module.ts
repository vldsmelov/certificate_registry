import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { AuthModule } from '../auth/auth.module';
import { RbacModule } from '../rbac/rbac.module';
import { CertificatesController } from './certificates.controller';
import { CertificatesService } from './certificates.service';
import { PdfRendererService } from './pdf-renderer.service';

@Module({
  imports: [PrismaModule, AuthModule, RbacModule],
  controllers: [CertificatesController],
  providers: [CertificatesService, PdfRendererService],
  exports: [CertificatesService, PdfRendererService],
})
export class CertificatesModule {}

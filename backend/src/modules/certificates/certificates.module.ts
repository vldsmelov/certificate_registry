import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { CertificatesService } from './certificates.service';

@Module({
  imports: [PrismaModule],
  providers: [CertificatesService],
  exports: [CertificatesService],
})
export class CertificatesModule {}

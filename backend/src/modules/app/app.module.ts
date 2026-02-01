import { Module } from '@nestjs/common';
import { HealthController } from './health.controller';
import { PrismaModule } from '../prisma/prisma.module';
import { CertsPublicController } from '../certs/certs.public.controller';
import { CertsInternalController } from '../certs/certs.internal.controller';
import { AuthModule } from '../auth/auth.module';
import { BootstrapModule } from '../bootstrap/bootstrap.module';
import { RbacModule } from '../rbac/rbac.module';
import { ExamTypesModule } from '../exam-types/exam-types.module';
import { AttemptsModule } from '../attempts/attempts.module';
import { ApprovalsModule } from '../approvals/approvals.module';
import { CertificatesModule } from '../certificates/certificates.module';
import { TemplatesModule } from '../templates/templates.module';

@Module({
  imports: [
    PrismaModule,
    AuthModule,
    RbacModule,
    BootstrapModule,
    CertificatesModule,
    ExamTypesModule,
    AttemptsModule,
    ApprovalsModule,
    TemplatesModule,
  ],
  controllers: [HealthController, CertsPublicController, CertsInternalController],
})
export class AppModule {}

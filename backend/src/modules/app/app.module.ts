import { Module } from '@nestjs/common';
import { HealthController } from './health.controller';
import { PrismaModule } from '../prisma/prisma.module';
import { CertsPublicController } from '../certs/certs.public.controller';
import { CertsInternalController } from '../certs/certs.internal.controller';
import { AuthModule } from '../auth/auth.module';
import { BootstrapModule } from '../bootstrap/bootstrap.module';
import { RbacModule } from '../rbac/rbac.module';

@Module({
  imports: [PrismaModule, AuthModule, RbacModule, BootstrapModule],
  controllers: [HealthController, CertsPublicController, CertsInternalController],
})
export class AppModule {}

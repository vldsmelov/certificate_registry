import { Module } from '@nestjs/common';
import { HealthController } from './health.controller';
import { PrismaModule } from '../prisma/prisma.module';
import { CertsPublicController } from '../certs/certs.public.controller';
import { CertsInternalController } from '../certs/certs.internal.controller';

@Module({
  imports: [PrismaModule],
  controllers: [HealthController, CertsPublicController, CertsInternalController],
})
export class AppModule {}

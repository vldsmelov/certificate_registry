import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { AuthModule } from '../auth/auth.module';
import { ExamTypesController } from './exam-types.controller';
import { ExamTypesService } from './exam-types.service';

@Module({
  imports: [PrismaModule, AuthModule],
  controllers: [ExamTypesController],
  providers: [ExamTypesService],
  exports: [ExamTypesService],
})
export class ExamTypesModule {}

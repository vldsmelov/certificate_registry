import { Controller, Get, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { ExamTypesService } from './exam-types.service';

@Controller('/exam-types')
@UseGuards(JwtAuthGuard)
export class ExamTypesController {
  constructor(private readonly service: ExamTypesService) {}

  @Get()
  async list() {
    return this.service.list();
  }
}

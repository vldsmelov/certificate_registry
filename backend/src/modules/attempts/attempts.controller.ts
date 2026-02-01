import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Param,
  Post,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { PermissionsGuard } from '../rbac/permissions.guard';
import { RequirePermissions } from '../rbac/permissions.decorator';
import { CurrentUser } from '../auth/current-user.decorator';
import { AuthUser } from '../auth/auth.types';
import { AttemptsService } from './attempts.service';

@Controller('/attempts')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class AttemptsController {
  constructor(private readonly service: AttemptsService) {}

  @Get('/mine')
  async mine(@CurrentUser() user: AuthUser) {
    return this.service.listMine(user.id);
  }

  @Post()
  @RequirePermissions('exam:create')
  async create(
    @CurrentUser() user: AuthUser,
    @Body() body: any,
  ) {
    const fullName = String(body.fullName ?? '').trim();
    const position = String(body.position ?? '').trim();
    const employeeCode = body.employeeCode ? String(body.employeeCode).trim() : null;
    const examTypeId = String(body.examTypeId ?? '').trim();
    const grade = String(body.grade ?? '').trim();
    const examDate = body.examDate ? new Date(body.examDate) : new Date();
    const signerUserId = body.signerUserId ? String(body.signerUserId).trim() : null;
    const notes = body.notes ? String(body.notes).trim() : null;

    if (!fullName) throw new BadRequestException('fullName is required');
    if (!position) throw new BadRequestException('position is required');
    if (!examTypeId) throw new BadRequestException('examTypeId is required');
    if (!['gold', 'silver', 'fail'].includes(grade)) throw new BadRequestException('grade must be gold|silver|fail');
    if (Number.isNaN(examDate.getTime())) throw new BadRequestException('examDate is invalid');

    return this.service.createAttempt({
      createdById: user.id,
      person: { fullName, position, employeeCode },
      examTypeId,
      grade: grade as any,
      examDate,
      signerUserId,
      notes,
    });
  }

  @Post('/:id/submit')
  @RequirePermissions('exam:submit')
  async submit(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.service.submitAttempt({ attemptId: id, userId: user.id });
  }
}

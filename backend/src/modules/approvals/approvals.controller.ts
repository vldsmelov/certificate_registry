import { BadRequestException, Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import { AuthUser } from '../auth/auth.types';
import { PermissionsGuard } from '../rbac/permissions.guard';
import { RequirePermissions } from '../rbac/permissions.decorator';
import { ApprovalsService } from './approvals.service';

@Controller('/approvals')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class ApprovalsController {
  constructor(private readonly service: ApprovalsService) {}

  @Get('/inbox')
  @RequirePermissions('approval:review')
  async inbox(@CurrentUser() user: AuthUser) {
    return this.service.inbox(user.id);
  }

  @Post('/:id/approve')
  @RequirePermissions('approval:approve')
  async approve(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.service.approve(id, user.id);
  }

  @Post('/:id/reject')
  @RequirePermissions('approval:reject')
  async reject(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() body: any) {
    const reason = body?.reason ? String(body.reason).trim() : null;
    return this.service.reject(id, user.id, reason);
  }

  @Post('/bulk')
  @RequirePermissions('approval:bulk_action')
  async bulk(@CurrentUser() user: AuthUser, @Body() body: any) {
    const action = String(body?.action ?? '').trim();
    const approvalIds = body?.approvalIds;
    const reason = body?.reason ? String(body.reason).trim() : null;

    if (!['approve', 'reject'].includes(action)) {
      throw new BadRequestException('action must be approve|reject');
    }

    return this.service.bulkDecide({
      signerUserId: user.id,
      action: action as any,
      approvalIds: Array.isArray(approvalIds) ? approvalIds.map(String) : [],
      reason,
    });
  }
}

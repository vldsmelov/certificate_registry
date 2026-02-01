import { Controller, Get, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { PermissionsGuard } from '../rbac/permissions.guard';
import { RequirePermissions } from '../rbac/permissions.decorator';
import { UsersService } from './users.service';

@Controller('/users')
@UseGuards(JwtAuthGuard, PermissionsGuard)
@RequirePermissions('users:read')
export class UsersController {
  constructor(private readonly users: UsersService) {}

  @Get()
  async list() {
    return this.users.listUsers();
  }
}

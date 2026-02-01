import { Injectable } from '@nestjs/common';
import * as bcrypt from 'bcryptjs';
import { PrismaService } from '../prisma/prisma.service';
import { RbacService } from '../rbac/rbac.service';
import { AuthUser } from '../auth/auth.types';

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService, private readonly rbac: RbacService) {}

  async validateUserPassword(email: string, password: string) {
    const user = await this.prisma.appUser.findUnique({ where: { email } });
    if (!user || !user.isActive) return null;

    const ok = await bcrypt.compare(password, user.passwordHash);
    if (!ok) return null;

    const permissions = await this.rbac.getUserPermissions(user.id);
    return { id: user.id, email: user.email, displayName: user.displayName, permissions };
  }

  async getAuthUserById(userId: string): Promise<AuthUser | null> {
    const user = await this.prisma.appUser.findUnique({ where: { id: userId } });
    if (!user || !user.isActive) return null;

    const permissions = await this.rbac.getUserPermissions(user.id);
    return { id: user.id, email: user.email, displayName: user.displayName ?? null, permissions };
  }
}

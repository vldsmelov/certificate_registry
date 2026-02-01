import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class RbacService {
  constructor(private readonly prisma: PrismaService) {}

  async getUserPermissions(userId: string): Promise<string[]> {
    const roles = await this.prisma.userRole.findMany({
      where: { userId },
      include: {
        role: {
          include: {
            permissions: {
              include: { permission: true },
            },
          },
        },
      },
    });

    const permSet = new Set<string>();
    for (const ur of roles) {
      for (const rp of ur.role.permissions) {
        permSet.add(rp.permission.code);
      }
    }
    return Array.from(permSet).sort();
  }
}

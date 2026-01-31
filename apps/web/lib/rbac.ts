import { PermissionKey } from '@cert-registry/domain';

export type SessionUser = {
  id: string;
  permissions: PermissionKey[];
};

export function requirePermission(user: SessionUser | null, permission: PermissionKey) {
  if (!user) {
    throw new Error('Unauthorized');
  }
  if (!user.permissions.includes(permission)) {
    throw new Error('Forbidden');
  }
}

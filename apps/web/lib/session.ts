import { cookies } from 'next/headers';
import { PermissionKey } from '@cert-registry/domain';

export type SessionInfo = {
  userId: string;
  permissions: PermissionKey[];
};

export function getSession(): SessionInfo | null {
  const cookieStore = cookies();
  const userId = cookieStore.get('mock_user_id')?.value;
  if (!userId) {
    return null;
  }
  const permissionsCookie = cookieStore.get('mock_permissions')?.value ?? '';
  const permissions = permissionsCookie.split(',').filter(Boolean) as PermissionKey[];
  return { userId, permissions };
}

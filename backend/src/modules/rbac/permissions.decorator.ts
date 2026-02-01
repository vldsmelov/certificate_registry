import { SetMetadata } from '@nestjs/common';

export const PERMISSIONS_KEY = 'required_permissions';

export const RequirePermissions = (...perms: string[]) => SetMetadata(PERMISSIONS_KEY, perms);

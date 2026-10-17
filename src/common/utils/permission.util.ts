import { ALL_PERMISSIONS } from '../constants/permissions.constant';
import { AuthUser } from '../interfaces/auth-user.interface';

export function hasPermission(user: AuthUser, permission: string): boolean {
  if (!user?.permissions) return false;
  return (
    user.permissions.includes(ALL_PERMISSIONS) ||
    user.permissions.includes(permission)
  );
}

export function hasAnyPermission(
  user: AuthUser,
  permissions: string[],
): boolean {
  return permissions.some((p) => hasPermission(user, p));
}

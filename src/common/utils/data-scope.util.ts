import { Types } from 'mongoose';
import { AuthUser } from '../interfaces/auth-user.interface';
import { hasPermission } from './permission.util';

export interface ScopeOptions {
  /** Quyền xem toàn bộ dữ liệu */
  allPermission: string;
  /** Quyền xem dữ liệu phòng ban (tuỳ chọn) */
  departmentPermission?: string;
  /** Tên trường phòng ban trong collection (mặc định departmentId) */
  departmentField?: string;
  /** Filter "của tôi" khi user không có quyền all/department */
  ownFilter: (userId: Types.ObjectId) => Record<string, any>;
}

/** Gộp nhiều điều kiện filter bằng $and (bỏ qua điều kiện rỗng) */
export function combineFilters(
  ...parts: Record<string, any>[]
): Record<string, any> {
  const nonEmpty = parts.filter((p) => p && Object.keys(p).length > 0);
  if (nonEmpty.length === 0) return {};
  if (nonEmpty.length === 1) return nonEmpty[0];
  return { $and: nonEmpty };
}

/**
 * Sinh filter phạm vi dữ liệu theo quyền:
 *  - có quyền *_all       → không giới hạn
 *  - có quyền *_department → chỉ dữ liệu phòng ban của user (cộng thêm dữ liệu của chính mình)
 *  - còn lại              → chỉ dữ liệu của chính mình
 */
export function buildScopeFilter(
  user: AuthUser,
  options: ScopeOptions,
): Record<string, any> {
  if (hasPermission(user, options.allPermission)) return {};

  const userId = new Types.ObjectId(user.id);
  const own = options.ownFilter(userId);

  if (
    options.departmentPermission &&
    hasPermission(user, options.departmentPermission) &&
    user.departmentId
  ) {
    const field = options.departmentField || 'departmentId';
    return {
      $or: [{ [field]: new Types.ObjectId(user.departmentId) }, own],
    };
  }
  return own;
}

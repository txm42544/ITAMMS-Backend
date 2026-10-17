import { ConflictException } from '@nestjs/common';
import { Connection } from 'mongoose';

export interface ReferenceCheck {
  /** Tên model (đã đăng ký trên cùng connection) */
  model: string;
  field: string;
  /** Tên hiển thị, vd: 'tài sản' */
  label: string;
  /** Điều kiện bổ sung (mặc định chỉ đếm bản ghi còn hoạt động) */
  extra?: Record<string, any>;
}

/** Ném 409 nếu bản ghi còn đang được tham chiếu ở collection khác */
export async function ensureNotReferenced(
  connection: Connection,
  id: any,
  checks: ReferenceCheck[],
) {
  for (const check of checks) {
    const model = connection.models[check.model];
    if (!model) continue;
    const filter = {
      [check.field]: id,
      ...(check.extra ?? { isActive: { $ne: false } }),
    };
    const count = await model.countDocuments(filter);
    if (count > 0) {
      throw new ConflictException(
        `Không thể xoá: đang có ${count} ${check.label} sử dụng`,
      );
    }
  }
}

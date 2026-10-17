import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { RefType } from '../../common/constants/system-codes';
import { paginate } from '../../common/utils/paginate.util';
import { createApiResponse } from '../../common/utils/response.util';
import { UsersService } from '../users/users.service';
import { NotificationQueryDto } from './dto/notification.dto';
import { Notification, NotificationType } from './schemas/notification.schema';

export interface NotifyPayload {
  type: NotificationType;
  title: string;
  content?: string;
  refType?: RefType;
  refId?: any;
}

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);

  constructor(
    @InjectModel(Notification.name)
    private readonly notificationModel: Model<Notification>,
    private readonly usersService: UsersService,
  ) {}

  /**
   * Gửi thông báo in-app cho danh sách user.
   * Bỏ qua id rỗng / trùng và người thực hiện thao tác (excludeUserId).
   */
  async notifyUsers(
    userIds: (Types.ObjectId | string | null | undefined)[],
    payload: NotifyPayload,
    excludeUserId?: string,
  ): Promise<void> {
    const ids = [
      ...new Set(userIds.filter(Boolean).map((id) => String(id))),
    ].filter((id) => id !== excludeUserId);
    if (!ids.length) return;
    try {
      await this.notificationModel.insertMany(
        ids.map((userId) => ({ ...payload, userId })),
      );
    } catch (error) {
      this.logger.warn(`Gửi thông báo thất bại: ${error.message}`);
    }
  }

  /** Gửi thông báo cho mọi user có quyền cụ thể (vd: quản lý tài sản) */
  async notifyPermission(
    permission: string,
    payload: NotifyPayload,
    options: { departmentId?: any; excludeUserId?: string } = {},
  ): Promise<void> {
    const ids = await this.usersService.findIdsByPermission(permission, {
      departmentId: options.departmentId,
    });
    await this.notifyUsers(ids, payload, options.excludeUserId);
  }

  async findMine(userId: string, query: NotificationQueryDto) {
    const filter: Record<string, any> = { userId };
    if (query.isRead !== undefined) filter.isRead = query.isRead;
    if (query.type) filter.type = query.type;
    return paginate(this.notificationModel, filter, query, {
      message: 'Lấy danh sách thông báo thành công',
    });
  }

  async unreadCount(userId: string) {
    const count = await this.notificationModel.countDocuments({
      userId,
      isRead: false,
    });
    return createApiResponse({ count }, 'Thành công');
  }

  async markRead(id: string, userId: string) {
    const n = await this.notificationModel.findOneAndUpdate(
      { _id: id, userId },
      { isRead: true, readAt: new Date() },
      { new: true },
    );
    if (!n) throw new NotFoundException('Không tìm thấy thông báo');
    return createApiResponse(n, 'Đã đánh dấu đã đọc');
  }

  async markAllRead(userId: string) {
    const res = await this.notificationModel.updateMany(
      { userId, isRead: false },
      { isRead: true, readAt: new Date() },
    );
    return createApiResponse(
      { updated: res.modifiedCount },
      'Đã đánh dấu tất cả là đã đọc',
    );
  }

  async remove(id: string, userId: string) {
    const res = await this.notificationModel.deleteOne({ _id: id, userId });
    if (!res.deletedCount)
      throw new NotFoundException('Không tìm thấy thông báo');
    return createApiResponse(null, 'Xoá thông báo thành công');
  }
}

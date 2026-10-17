import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';
import { RefType } from '../../../common/constants/system-codes';

export enum NotificationType {
  // Sự cố
  TICKET_CREATED = 'TICKET_CREATED',
  TICKET_ASSIGNED = 'TICKET_ASSIGNED',
  TICKET_UPDATED = 'TICKET_UPDATED',
  TICKET_RESOLVED = 'TICKET_RESOLVED',
  TICKET_CLOSED = 'TICKET_CLOSED',
  TICKET_REOPENED = 'TICKET_REOPENED',
  TICKET_OVERDUE = 'TICKET_OVERDUE',
  // Đề xuất sửa chữa / thay thế
  REPAIR_REQUEST_PENDING = 'REPAIR_REQUEST_PENDING',
  REPAIR_REQUEST_DECIDED = 'REPAIR_REQUEST_DECIDED',
  // Vòng đời tài sản
  ASSET_REQUEST_PENDING = 'ASSET_REQUEST_PENDING',
  ASSET_REQUEST_DECIDED = 'ASSET_REQUEST_DECIDED',
  ASSET_REQUEST_COMPLETED = 'ASSET_REQUEST_COMPLETED',
  // Bảo trì
  MAINTENANCE_ASSIGNED = 'MAINTENANCE_ASSIGNED',
  MAINTENANCE_OVERDUE = 'MAINTENANCE_OVERDUE',
  // Cảnh báo
  WARRANTY_EXPIRING = 'WARRANTY_EXPIRING',
  LOW_STOCK = 'LOW_STOCK',
  SYSTEM = 'SYSTEM',
}

@Schema({ timestamps: true })
export class Notification extends Document {
  @Prop({ type: Types.ObjectId, ref: 'User', required: true, index: true })
  userId: Types.ObjectId;

  @Prop({ type: String, enum: Object.values(NotificationType), required: true })
  type: NotificationType;

  @Prop({ type: String, required: true })
  title: string;

  @Prop({ type: String })
  content?: string;

  @Prop({ type: String, enum: Object.values(RefType) })
  refType?: RefType;

  @Prop({ type: Types.ObjectId })
  refId?: Types.ObjectId;

  @Prop({ type: Boolean, default: false })
  isRead: boolean;

  @Prop({ type: Date })
  readAt?: Date;

  createdAt?: Date;
}

export const NotificationSchema = SchemaFactory.createForClass(Notification);
NotificationSchema.index({ userId: 1, isRead: 1, createdAt: -1 });

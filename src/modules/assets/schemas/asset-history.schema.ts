import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';
import { RefType } from '../../../common/constants/system-codes';

export enum AssetHistoryAction {
  CREATED = 'CREATED',
  UPDATED = 'UPDATED',
  ASSIGNED = 'ASSIGNED', // cấp phát
  HANDED_OVER = 'HANDED_OVER', // bàn giao cho người khác
  RETURNED = 'RETURNED', // thu hồi về kho
  TRANSFERRED = 'TRANSFERRED', // điều chuyển phòng ban
  STATUS_CHANGED = 'STATUS_CHANGED',
  INCIDENT_REPORTED = 'INCIDENT_REPORTED',
  REPAIRED = 'REPAIRED',
  MAINTAINED = 'MAINTAINED',
  PART_REPLACED = 'PART_REPLACED',
  DISPOSED = 'DISPOSED', // thanh lý
  QR_REGENERATED = 'QR_REGENERATED',
}

/** Nhật ký biến động của tài sản — nguồn dữ liệu cho "Theo dõi lịch sử tài sản" */
@Schema({ timestamps: { createdAt: true, updatedAt: false } })
export class AssetHistory extends Document {
  @Prop({ type: Types.ObjectId, ref: 'Asset', required: true, index: true })
  assetId: Types.ObjectId;

  @Prop({
    type: String,
    enum: Object.values(AssetHistoryAction),
    required: true,
  })
  action: AssetHistoryAction;

  @Prop({ type: String })
  description?: string;

  @Prop({ type: Types.ObjectId, ref: 'User' })
  fromUserId?: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'User' })
  toUserId?: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'Department' })
  fromDepartmentId?: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'Department' })
  toDepartmentId?: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'Location' })
  fromLocationId?: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'Location' })
  toLocationId?: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'AssetStatus' })
  fromStatusId?: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'AssetStatus' })
  toStatusId?: Types.ObjectId;

  /** Chứng từ liên quan (yêu cầu, ticket, phiếu bảo trì...) */
  @Prop({ type: String, enum: Object.values(RefType) })
  refType?: RefType;

  @Prop({ type: Types.ObjectId })
  refId?: Types.ObjectId;

  /** Chi phí phát sinh (sửa chữa / bảo trì) */
  @Prop({ type: Number })
  cost?: number;

  /** Các trường thay đổi: { field: { from, to } } */
  @Prop({ type: Object })
  changes?: Record<string, { from: any; to: any }>;

  @Prop({ type: Types.ObjectId, ref: 'User' })
  performedBy?: Types.ObjectId;

  createdAt?: Date;
}

export const AssetHistorySchema = SchemaFactory.createForClass(AssetHistory);
AssetHistorySchema.index({ assetId: 1, createdAt: -1 });

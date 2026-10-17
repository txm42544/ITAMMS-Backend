import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Types } from 'mongoose';
import { BaseEntity } from '../../../common/schemas/base.schema';

export enum RepairRequestType {
  EXTERNAL_REPAIR = 'EXTERNAL_REPAIR', // Gửi sửa ngoài / bảo hành hãng
  REPLACE_PART = 'REPLACE_PART', // Thay linh kiện (chi phí lớn / ngoài kho)
  REPLACE_DEVICE = 'REPLACE_DEVICE', // Thay thiết bị mới
  UPGRADE = 'UPGRADE', // Nâng cấp
}

export enum RepairRequestStatus {
  PENDING = 'PENDING',
  APPROVED = 'APPROVED',
  REJECTED = 'REJECTED',
  CANCELLED = 'CANCELLED',
}

@Schema({ _id: false })
export class RepairRequestItem {
  @Prop({ type: Types.ObjectId, ref: 'SparePart' })
  sparePartId?: Types.ObjectId;

  @Prop({ type: String, required: true })
  description: string;

  @Prop({ type: Number, default: 1 })
  quantity: number;

  @Prop({ type: Number, default: 0 })
  estimatedCost: number;
}
const RepairRequestItemSchema = SchemaFactory.createForClass(RepairRequestItem);

/** Đề xuất sửa chữa / thay thế do KTV lập, Quản lý tài sản duyệt */
@Schema({ timestamps: true })
export class RepairRequest extends BaseEntity {
  @Prop({ type: String, required: true, unique: true })
  code: string;

  @Prop({ type: Types.ObjectId, ref: 'Ticket', required: true, index: true })
  ticketId: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'Asset', index: true })
  assetId?: Types.ObjectId;

  @Prop({
    type: String,
    enum: Object.values(RepairRequestType),
    required: true,
  })
  type: RepairRequestType;

  @Prop({ type: [RepairRequestItemSchema], default: [] })
  items: RepairRequestItem[];

  /** Tổng chi phí dự kiến */
  @Prop({ type: Number, default: 0 })
  estimatedCost: number;

  /** Đơn vị sửa chữa bên ngoài (nếu có) */
  @Prop({ type: String })
  vendor?: string;

  @Prop({ type: String, required: true })
  reason: string;

  @Prop({
    type: String,
    enum: Object.values(RepairRequestStatus),
    default: RepairRequestStatus.PENDING,
    index: true,
  })
  status: RepairRequestStatus;

  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  proposedBy: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'User' })
  decidedBy?: Types.ObjectId;

  @Prop({ type: Date })
  decidedAt?: Date;

  @Prop({ type: String })
  decisionNote?: string;
}

export const RepairRequestSchema = SchemaFactory.createForClass(RepairRequest);

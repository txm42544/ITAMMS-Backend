import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Types } from 'mongoose';
import { BaseEntity } from '../../common/schemas/base.schema';

/** Loại cảnh báo tự động */
export enum AlertType {
  WARRANTY_EXPIRING = 'WARRANTY_EXPIRING',
  MAINTENANCE_DUE = 'MAINTENANCE_DUE',
  MAINTENANCE_OVERDUE = 'MAINTENANCE_OVERDUE',
  LOW_STOCK = 'LOW_STOCK',
  TICKET_OVERDUE = 'TICKET_OVERDUE',
}

/** Log gửi cảnh báo — dùng để chống gửi trùng */
@Schema({ timestamps: { createdAt: true, updatedAt: false } })
export class AlertLog extends BaseEntity {
  /** Khoá chống trùng, vd: WARRANTY:<assetId>:<warrantyEndDate> */
  @Prop({ type: String, required: true, unique: true, index: true })
  dedupeKey: string;

  @Prop({
    type: String,
    enum: Object.values(AlertType),
    required: true,
    index: true,
  })
  type: AlertType;

  @Prop({ type: Types.ObjectId, index: true })
  refId?: Types.ObjectId;

  /** Số người đã nhận thông báo trong lần gửi này */
  @Prop({ type: Number, default: 0 })
  notified: number;

  /** Lần cuối gửi (để theo dõi) */
  @Prop({ type: Date, default: () => new Date() })
  sentAt: Date;
}

export const AlertLogSchema = SchemaFactory.createForClass(AlertLog);
AlertLogSchema.index({ type: 1, sentAt: -1 });

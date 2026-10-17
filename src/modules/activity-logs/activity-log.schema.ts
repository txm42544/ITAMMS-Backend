import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

@Schema({ timestamps: { createdAt: true, updatedAt: false } })
export class ActivityLog extends Document {
  @Prop({ type: Types.ObjectId, ref: 'User', index: true })
  userId?: Types.ObjectId;

  @Prop({ type: String })
  username?: string;

  @Prop({ type: String, default: 'guest' })
  roleCode: string;

  /** LOGIN, LOGOUT, CREATE, UPDATE, DELETE */
  @Prop({ type: String, required: true, index: true })
  action: string;

  /** Module bị tác động (assets, tickets, ...) */
  @Prop({ type: String, required: true, index: true })
  module: string;

  @Prop({ type: String })
  description?: string;

  @Prop({ type: String })
  method: string;

  @Prop({ type: String })
  url: string;

  @Prop({ type: String })
  ip?: string;

  @Prop({ type: String })
  userAgent?: string;

  @Prop({ type: Object })
  payload?: any;

  @Prop({ type: String, enum: ['success', 'failure'], default: 'success' })
  status: string;

  @Prop({ type: Number })
  statusCode?: number;

  createdAt?: Date;
}

export const ActivityLogSchema = SchemaFactory.createForClass(ActivityLog);
ActivityLogSchema.index({ createdAt: -1 });

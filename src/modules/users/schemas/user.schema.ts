import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Types } from 'mongoose';
import { BaseEntity } from '../../../common/schemas/base.schema';

@Schema({ timestamps: true })
export class User extends BaseEntity {
  /** Mã nhân viên */
  @Prop({ type: String, required: true, uppercase: true, trim: true })
  employeeCode: string;

  @Prop({ type: String, required: true, lowercase: true, trim: true })
  username: string;

  @Prop({ type: String, required: true, lowercase: true, trim: true })
  email: string;

  @Prop({ type: String, required: true, select: false })
  password: string;

  @Prop({ type: String, required: true, trim: true })
  fullName: string;

  @Prop({ type: String })
  phone?: string;

  @Prop({ type: String })
  avatar?: string;

  /** Chức vụ */
  @Prop({ type: String })
  position?: string;

  @Prop({ type: Types.ObjectId, ref: 'Department', index: true })
  departmentId?: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'Role', required: true, index: true })
  roleId: Types.ObjectId;

  @Prop({ type: Boolean, default: false })
  isLocked: boolean;

  @Prop({ type: Date })
  lastLoginAt?: Date;

  /** SHA-256 của refresh token hiện hành (rotation) */
  @Prop({ type: String, select: false })
  refreshTokenHash?: string;
}

export const UserSchema = SchemaFactory.createForClass(User);
const activeOnly = { partialFilterExpression: { isActive: true } };
UserSchema.index({ username: 1 }, { unique: true, ...activeOnly });
UserSchema.index({ email: 1 }, { unique: true, ...activeOnly });
UserSchema.index({ employeeCode: 1 }, { unique: true, ...activeOnly });

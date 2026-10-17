import { Prop } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

/**
 * Các trường dùng chung cho mọi collection nghiệp vụ.
 * Schema con: `@Schema({ timestamps: true }) class X extends BaseEntity {}`
 */
export abstract class BaseEntity extends Document {
  @Prop({ type: Types.ObjectId, ref: 'User' })
  createdBy?: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'User' })
  updatedBy?: Types.ObjectId;

  /** Soft delete */
  @Prop({ type: Boolean, default: true, index: true })
  isActive: boolean;

  createdAt?: Date;
  updatedAt?: Date;
}

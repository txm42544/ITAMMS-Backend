import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { BaseEntity } from '../../../common/schemas/base.schema';

@Schema({ timestamps: true })
export class Role extends BaseEntity {
  @Prop({ type: String, required: true, uppercase: true, trim: true })
  code: string;

  @Prop({ type: String, required: true, trim: true })
  name: string;

  @Prop({ type: String })
  description?: string;

  @Prop({ type: [String], default: [] })
  permissions: string[];

  /** Role hệ thống: không xoá, không đổi mã */
  @Prop({ type: Boolean, default: false })
  isSystem: boolean;
}

export const RoleSchema = SchemaFactory.createForClass(Role);
RoleSchema.index(
  { code: 1 },
  { unique: true, partialFilterExpression: { isActive: true } },
);

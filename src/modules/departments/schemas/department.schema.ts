import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Types } from 'mongoose';
import { BaseEntity } from '../../../common/schemas/base.schema';

@Schema({ timestamps: true })
export class Department extends BaseEntity {
  @Prop({ type: String, required: true, uppercase: true, trim: true })
  code: string;

  @Prop({ type: String, required: true, trim: true })
  name: string;

  @Prop({ type: String })
  description?: string;

  /** Phòng ban cha (nếu có cấu trúc nhiều cấp) */
  @Prop({ type: Types.ObjectId, ref: 'Department' })
  parentId?: Types.ObjectId;

  /** Trưởng phòng — người phê duyệt các yêu cầu tài sản của phòng */
  @Prop({ type: Types.ObjectId, ref: 'User' })
  managerId?: Types.ObjectId;

  @Prop({ type: String })
  phone?: string;
}

export const DepartmentSchema = SchemaFactory.createForClass(Department);
DepartmentSchema.index(
  { code: 1 },
  { unique: true, partialFilterExpression: { isActive: true } },
);

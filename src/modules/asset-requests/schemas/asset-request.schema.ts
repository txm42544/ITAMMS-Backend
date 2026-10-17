import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Types } from 'mongoose';
import { BaseEntity } from '../../../common/schemas/base.schema';
import { FileRef, FileRefSchema } from '../../assets/schemas/asset.schema';

export enum AssetRequestType {
  ALLOCATION = 'ALLOCATION', // Cấp phát từ kho cho phòng ban / người dùng
  HANDOVER = 'HANDOVER', // Bàn giao cho người khác trong cùng phòng ban
  RETURN = 'RETURN', // Thu hồi về kho
  TRANSFER = 'TRANSFER', // Điều chuyển sang phòng ban khác
  DISPOSAL = 'DISPOSAL', // Thanh lý
}

export enum AssetRequestStatus {
  PENDING = 'PENDING', // Chờ duyệt
  APPROVED = 'APPROVED', // Đã duyệt, chờ thực hiện
  REJECTED = 'REJECTED',
  COMPLETED = 'COMPLETED', // Đã thực hiện xong
  CANCELLED = 'CANCELLED',
}

export enum ApprovalType {
  DEPARTMENT = 'DEPARTMENT', // Quản lý phòng ban duyệt
  DISPOSAL = 'DISPOSAL', // Duyệt thanh lý
}

export enum ApprovalDecision {
  PENDING = 'PENDING',
  APPROVED = 'APPROVED',
  REJECTED = 'REJECTED',
}

@Schema({ _id: false })
export class ApprovalStep {
  @Prop({ type: Number, required: true })
  step: number;

  @Prop({ type: String, enum: Object.values(ApprovalType), required: true })
  type: ApprovalType;

  /** Phòng ban phải duyệt (với type = DEPARTMENT) */
  @Prop({ type: Types.ObjectId, ref: 'Department' })
  departmentId?: Types.ObjectId;

  @Prop({
    type: String,
    enum: Object.values(ApprovalDecision),
    default: ApprovalDecision.PENDING,
  })
  decision: ApprovalDecision;

  @Prop({ type: Types.ObjectId, ref: 'User' })
  approverId?: Types.ObjectId;

  @Prop({ type: String })
  note?: string;

  @Prop({ type: Date })
  decidedAt?: Date;
}
const ApprovalStepSchema = SchemaFactory.createForClass(ApprovalStep);

@Schema({ _id: false })
export class PendingApproval {
  @Prop({ type: Number })
  step: number;

  @Prop({ type: String, enum: Object.values(ApprovalType) })
  type: ApprovalType;

  @Prop({ type: Types.ObjectId, ref: 'Department' })
  departmentId?: Types.ObjectId;
}
const PendingApprovalSchema = SchemaFactory.createForClass(PendingApproval);

@Schema({ timestamps: true })
export class AssetRequest extends BaseEntity {
  @Prop({ type: String, required: true, unique: true })
  code: string;

  @Prop({
    type: String,
    enum: Object.values(AssetRequestType),
    required: true,
    index: true,
  })
  type: AssetRequestType;

  @Prop({
    type: [{ type: Types.ObjectId, ref: 'Asset' }],
    required: true,
    index: true,
  })
  assetIds: Types.ObjectId[];

  @Prop({
    type: String,
    enum: Object.values(AssetRequestStatus),
    default: AssetRequestStatus.PENDING,
    index: true,
  })
  status: AssetRequestStatus;

  @Prop({ type: Types.ObjectId, ref: 'User', required: true, index: true })
  requestedBy: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'Department', index: true })
  fromDepartmentId?: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'Department', index: true })
  toDepartmentId?: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'User' })
  fromUserId?: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'User' })
  toUserId?: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'Location' })
  toLocationId?: Types.ObjectId;

  @Prop({ type: String, required: true })
  reason: string;

  @Prop({ type: Date })
  expectedDate?: Date;

  @Prop({ type: [ApprovalStepSchema], default: [] })
  approvals: ApprovalStep[];

  /** Bước duyệt hiện tại (null khi không còn chờ duyệt) — phục vụ lọc "chờ tôi duyệt" */
  @Prop({ type: PendingApprovalSchema, default: null })
  pendingApproval?: PendingApproval | null;

  @Prop({ type: Types.ObjectId, ref: 'User' })
  executedBy?: Types.ObjectId;

  @Prop({ type: Date })
  executedAt?: Date;

  @Prop({ type: String })
  executionNote?: string;

  /** Thông tin thanh lý (với type = DISPOSAL) */
  @Prop({ type: String })
  disposalMethod?: string;

  @Prop({ type: Number })
  recoveredValue?: number;

  /** Biên bản bàn giao / thanh lý */
  @Prop({ type: [FileRefSchema], default: [] })
  attachments: FileRef[];

  @Prop({ type: Types.ObjectId, ref: 'User' })
  cancelledBy?: Types.ObjectId;
}

export const AssetRequestSchema = SchemaFactory.createForClass(AssetRequest);
AssetRequestSchema.index({
  status: 1,
  'pendingApproval.type': 1,
  'pendingApproval.departmentId': 1,
});

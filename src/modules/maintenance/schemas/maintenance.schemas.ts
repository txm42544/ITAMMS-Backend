import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Types } from 'mongoose';
import { BaseEntity } from '../../../common/schemas/base.schema';
import { FileRef, FileRefSchema } from '../../assets/schemas/asset.schema';
import {
  UsedPart,
  UsedPartSchema,
} from '../../spare-parts/schemas/spare-part.schema';

export enum IntervalUnit {
  DAY = 'DAY',
  WEEK = 'WEEK',
  MONTH = 'MONTH',
}

@Schema({ _id: false })
export class ChecklistItem {
  @Prop({ type: String, required: true })
  item: string;

  @Prop({ type: Boolean, default: true })
  required: boolean;
}
const ChecklistItemSchema = SchemaFactory.createForClass(ChecklistItem);

@Schema({ _id: false })
export class PlanScope {
  @Prop({ type: [{ type: Types.ObjectId, ref: 'AssetCategory' }], default: [] })
  categoryIds: Types.ObjectId[];

  @Prop({ type: [{ type: Types.ObjectId, ref: 'Department' }], default: [] })
  departmentIds: Types.ObjectId[];

  @Prop({ type: [{ type: Types.ObjectId, ref: 'Asset' }], default: [] })
  assetIds: Types.ObjectId[];
}
const PlanScopeSchema = SchemaFactory.createForClass(PlanScope);

/** Kế hoạch bảo trì định kỳ */
@Schema({ timestamps: true })
export class MaintenancePlan extends BaseEntity {
  @Prop({ type: String, required: true, unique: true })
  code: string;

  @Prop({ type: String, required: true, trim: true })
  name: string;

  @Prop({ type: String })
  description?: string;

  /**
   * Phạm vi áp dụng: tài sản thuộc (loại ∈ categoryIds) VÀ (phòng ban ∈ departmentIds),
   * cộng thêm các tài sản chỉ định trong assetIds. Danh sách rỗng = không giới hạn theo tiêu chí đó.
   */
  @Prop({ type: PlanScopeSchema, default: () => ({}) })
  scope: PlanScope;

  @Prop({ type: Number, required: true, min: 1 })
  intervalValue: number;

  @Prop({
    type: String,
    enum: Object.values(IntervalUnit),
    default: IntervalUnit.MONTH,
  })
  intervalUnit: IntervalUnit;

  @Prop({ type: Date, required: true })
  startDate: Date;

  /** Ngày đến hạn của đợt bảo trì kế tiếp */
  @Prop({ type: Date, required: true, index: true })
  nextRunDate: Date;

  @Prop({ type: Date })
  endDate?: Date;

  /** Sinh phiếu trước ngày đến hạn bao nhiêu ngày */
  @Prop({ type: Number, default: 7 })
  leadDays: number;

  @Prop({ type: [ChecklistItemSchema], default: [] })
  checklist: ChecklistItem[];

  @Prop({ type: Types.ObjectId, ref: 'User' })
  defaultAssigneeId?: Types.ObjectId;

  @Prop({ type: Boolean, default: false })
  isPaused: boolean;

  @Prop({ type: Date })
  lastRunAt?: Date;

  @Prop({ type: Number, default: 0 })
  runCount: number;
}
export const MaintenancePlanSchema =
  SchemaFactory.createForClass(MaintenancePlan);

export enum MaintenanceTaskStatus {
  SCHEDULED = 'SCHEDULED', // Đã lên lịch
  IN_PROGRESS = 'IN_PROGRESS',
  COMPLETED = 'COMPLETED',
  OVERDUE = 'OVERDUE', // Quá hạn chưa thực hiện
  SKIPPED = 'SKIPPED', // Bỏ qua đợt này
  CANCELLED = 'CANCELLED',
}

export const OPEN_TASK_STATUSES = [
  MaintenanceTaskStatus.SCHEDULED,
  MaintenanceTaskStatus.IN_PROGRESS,
  MaintenanceTaskStatus.OVERDUE,
];

export enum MaintenanceType {
  PREVENTIVE = 'PREVENTIVE', // Theo kế hoạch định kỳ
  AD_HOC = 'AD_HOC', // Phát sinh
}

export enum AssetCondition {
  GOOD = 'GOOD',
  FAIR = 'FAIR',
  POOR = 'POOR',
}

@Schema({ _id: false })
export class ChecklistResult {
  @Prop({ type: String, required: true })
  item: string;

  @Prop({ type: Boolean, default: true })
  required: boolean;

  /** null = chưa kiểm tra */
  @Prop({ type: Boolean, default: null })
  ok: boolean | null;

  @Prop({ type: String })
  note?: string;
}
const ChecklistResultSchema = SchemaFactory.createForClass(ChecklistResult);

/** Phiếu bảo trì cho từng tài sản */
@Schema({ timestamps: true })
export class MaintenanceTask extends BaseEntity {
  @Prop({ type: String, required: true, unique: true })
  code: string;

  @Prop({
    type: String,
    enum: Object.values(MaintenanceType),
    default: MaintenanceType.PREVENTIVE,
  })
  type: MaintenanceType;

  @Prop({ type: Types.ObjectId, ref: 'MaintenancePlan', index: true })
  planId?: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'Asset', required: true, index: true })
  assetId: Types.ObjectId;

  /** Phòng ban của tài sản lúc tạo phiếu (phục vụ lọc theo phòng ban) */
  @Prop({ type: Types.ObjectId, ref: 'Department', index: true })
  departmentId?: Types.ObjectId;

  @Prop({ type: String, required: true })
  title: string;

  @Prop({ type: Date, required: true, index: true })
  scheduledDate: Date;

  @Prop({ type: Types.ObjectId, ref: 'User', index: true })
  assigneeId?: Types.ObjectId;

  @Prop({
    type: String,
    enum: Object.values(MaintenanceTaskStatus),
    default: MaintenanceTaskStatus.SCHEDULED,
    index: true,
  })
  status: MaintenanceTaskStatus;

  @Prop({ type: [ChecklistResultSchema], default: [] })
  checklistResults: ChecklistResult[];

  @Prop({ type: String })
  result?: string;

  @Prop({ type: String, enum: Object.values(AssetCondition) })
  conditionAfter?: AssetCondition;

  @Prop({ type: [UsedPartSchema], default: [] })
  partsUsed: UsedPart[];

  @Prop({ type: Number, default: 0 })
  partsCost: number;

  @Prop({ type: Number, default: 0 })
  laborCost: number;

  @Prop({ type: Number, default: 0 })
  totalCost: number;

  @Prop({ type: [FileRefSchema], default: [] })
  images: FileRef[];

  @Prop({ type: Date })
  startedAt?: Date;

  @Prop({ type: Date })
  completedAt?: Date;

  @Prop({ type: Types.ObjectId, ref: 'User' })
  completedBy?: Types.ObjectId;

  @Prop({ type: String })
  skipReason?: string;
}
export const MaintenanceTaskSchema =
  SchemaFactory.createForClass(MaintenanceTask);
MaintenanceTaskSchema.index({ status: 1, scheduledDate: 1 });

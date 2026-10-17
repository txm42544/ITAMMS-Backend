import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Types } from 'mongoose';
import { BaseEntity } from '../../../common/schemas/base.schema';

const uniqueActiveCode = [
  { code: 1 },
  { unique: true, partialFilterExpression: { isActive: true } },
] as const;

export enum TicketPriority {
  LOW = 'LOW',
  MEDIUM = 'MEDIUM',
  HIGH = 'HIGH',
  CRITICAL = 'CRITICAL',
}

/* ===================== Vị trí (toà nhà / tầng / phòng) ===================== */
@Schema({ timestamps: true })
export class Location extends BaseEntity {
  @Prop({ type: String, required: true, uppercase: true, trim: true })
  code: string;

  @Prop({ type: String, required: true, trim: true })
  name: string;

  @Prop({ type: String })
  building?: string;

  @Prop({ type: String })
  floor?: string;

  @Prop({ type: String })
  room?: string;

  @Prop({ type: Types.ObjectId, ref: 'Department', index: true })
  departmentId?: Types.ObjectId;

  @Prop({ type: String })
  description?: string;
}
export const LocationSchema = SchemaFactory.createForClass(Location);
LocationSchema.index(...uniqueActiveCode);

/* ===================== Nhà cung cấp ===================== */
@Schema({ timestamps: true })
export class Supplier extends BaseEntity {
  @Prop({ type: String, required: true, uppercase: true, trim: true })
  code: string;

  @Prop({ type: String, required: true, trim: true })
  name: string;

  @Prop({ type: String })
  taxCode?: string;

  @Prop({ type: String })
  contactPerson?: string;

  @Prop({ type: String })
  phone?: string;

  @Prop({ type: String })
  email?: string;

  @Prop({ type: String })
  address?: string;

  @Prop({ type: String })
  website?: string;

  @Prop({ type: String })
  notes?: string;
}
export const SupplierSchema = SchemaFactory.createForClass(Supplier);
SupplierSchema.index(...uniqueActiveCode);

/* ===================== Loại thiết bị ===================== */
@Schema({ _id: false })
export class SpecField {
  /** Khoá trong asset.specs, vd: cpu */
  @Prop({ type: String, required: true })
  key: string;

  /** Nhãn hiển thị, vd: Bộ vi xử lý */
  @Prop({ type: String, required: true })
  label: string;

  @Prop({ type: Boolean, default: false })
  required: boolean;
}
const SpecFieldSchema = SchemaFactory.createForClass(SpecField);

@Schema({ timestamps: true })
export class AssetCategory extends BaseEntity {
  @Prop({ type: String, required: true, uppercase: true, trim: true })
  code: string;

  @Prop({ type: String, required: true, trim: true })
  name: string;

  /** Tiền tố mã tài sản, vd: LT → LT-2026-0001 */
  @Prop({ type: String, required: true, uppercase: true, trim: true })
  codePrefix: string;

  @Prop({ type: String })
  description?: string;

  /** Các thông số cấu hình cần nhập cho loại thiết bị này */
  @Prop({ type: [SpecFieldSchema], default: [] })
  specFields: SpecField[];

  /** Chu kỳ bảo trì mặc định (tháng) */
  @Prop({ type: Number, default: 6 })
  defaultMaintenanceCycleMonths: number;

  /** Số năm sử dụng dự kiến (dùng gợi ý thay thế) */
  @Prop({ type: Number, default: 5 })
  usefulLifeYears: number;
}
export const AssetCategorySchema = SchemaFactory.createForClass(AssetCategory);
AssetCategorySchema.index(...uniqueActiveCode);

/* ===================== Trạng thái thiết bị ===================== */
@Schema({ timestamps: true })
export class AssetStatus extends BaseEntity {
  @Prop({ type: String, required: true, uppercase: true, trim: true })
  code: string;

  @Prop({ type: String, required: true, trim: true })
  name: string;

  /** Màu hiển thị trên UI, vd: #16a34a */
  @Prop({ type: String, default: '#64748b' })
  color: string;

  @Prop({ type: Number, default: 0 })
  order: number;

  @Prop({ type: String })
  description?: string;

  /** Trạng thái hệ thống: không xoá, không đổi mã */
  @Prop({ type: Boolean, default: false })
  isSystem: boolean;

  /** Cho phép cấp phát tài sản ở trạng thái này */
  @Prop({ type: Boolean, default: false })
  allowAssign: boolean;

  /** Trạng thái kết thúc vòng đời (đã thanh lý) — khoá mọi thao tác */
  @Prop({ type: Boolean, default: false })
  isFinal: boolean;
}
export const AssetStatusSchema = SchemaFactory.createForClass(AssetStatus);
AssetStatusSchema.index(...uniqueActiveCode);

/* ===================== Loại sự cố ===================== */
@Schema({ timestamps: true })
export class IncidentType extends BaseEntity {
  @Prop({ type: String, required: true, uppercase: true, trim: true })
  code: string;

  @Prop({ type: String, required: true, trim: true })
  name: string;

  @Prop({
    type: String,
    enum: Object.values(TicketPriority),
    default: TicketPriority.MEDIUM,
  })
  defaultPriority: TicketPriority;

  /** Thời hạn xử lý (giờ) tính từ lúc tiếp nhận */
  @Prop({ type: Number, default: 24 })
  slaHours: number;

  @Prop({ type: String })
  description?: string;
}
export const IncidentTypeSchema = SchemaFactory.createForClass(IncidentType);
IncidentTypeSchema.index(...uniqueActiveCode);

/* ===================== Cấu hình hệ thống ===================== */
@Schema({ timestamps: true })
export class Setting extends BaseEntity {
  @Prop({ type: String, required: true, unique: true })
  key: string;

  @Prop({ type: Object })
  value: any;

  @Prop({
    type: String,
    enum: ['number', 'string', 'boolean'],
    default: 'string',
  })
  type: string;

  @Prop({ type: String })
  description?: string;
}
export const SettingSchema = SchemaFactory.createForClass(Setting);

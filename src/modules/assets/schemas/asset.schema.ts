import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Types } from 'mongoose';
import { BaseEntity } from '../../../common/schemas/base.schema';

@Schema({ _id: false })
export class FileRef {
  @Prop({ type: String, required: true })
  url: string;

  @Prop({ type: String })
  publicId?: string;

  @Prop({ type: String })
  name?: string;
}
export const FileRefSchema = SchemaFactory.createForClass(FileRef);

@Schema({ _id: false })
export class DisposalInfo {
  @Prop({ type: String })
  method?: string; // Bán, Tiêu huỷ, Tặng...

  @Prop({ type: Number, default: 0 })
  recoveredValue?: number;

  @Prop({ type: String })
  note?: string;

  @Prop({ type: Types.ObjectId, ref: 'AssetRequest' })
  requestId?: Types.ObjectId;
}
const DisposalInfoSchema = SchemaFactory.createForClass(DisposalInfo);

@Schema({ timestamps: true })
export class Asset extends BaseEntity {
  /** Mã tài sản tự sinh theo loại thiết bị, vd: LT-2026-0001 */
  @Prop({ type: String, required: true, unique: true })
  assetCode: string;

  @Prop({ type: String, required: true, trim: true })
  name: string;

  @Prop({
    type: Types.ObjectId,
    ref: 'AssetCategory',
    required: true,
    index: true,
  })
  categoryId: Types.ObjectId;

  @Prop({ type: String, trim: true })
  brand?: string;

  @Prop({ type: String, trim: true })
  deviceModel?: string;

  @Prop({ type: String, trim: true })
  serialNumber?: string;

  /** Thông số cấu hình theo specFields của loại thiết bị (cpu, ram, storage, os...) */
  @Prop({ type: Object, default: {} })
  specs: Record<string, any>;

  /* ---------- Mua sắm & bảo hành ---------- */
  @Prop({ type: Types.ObjectId, ref: 'Supplier', index: true })
  supplierId?: Types.ObjectId;

  @Prop({ type: Date })
  purchaseDate?: Date;

  @Prop({ type: Number, default: 0 })
  purchasePrice: number;

  @Prop({ type: String })
  invoiceNumber?: string;

  @Prop({ type: Date })
  warrantyStartDate?: Date;

  @Prop({ type: Date, index: true })
  warrantyEndDate?: Date;

  /* ---------- Trạng thái & vị trí sử dụng ---------- */
  @Prop({
    type: Types.ObjectId,
    ref: 'AssetStatus',
    required: true,
    index: true,
  })
  statusId: Types.ObjectId;

  /** Trạng thái trước khi đưa vào sửa chữa / bảo trì (để khôi phục) */
  @Prop({ type: Types.ObjectId, ref: 'AssetStatus' })
  statusBeforeService?: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'Department', index: true })
  departmentId?: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'Location', index: true })
  locationId?: Types.ObjectId;

  /** Người đang sử dụng */
  @Prop({ type: Types.ObjectId, ref: 'User', index: true })
  currentUserId?: Types.ObjectId;

  @Prop({ type: Date })
  assignedAt?: Date;

  /* ---------- QR ---------- */
  @Prop({ type: String, required: true, unique: true })
  qrToken: string;

  /* ---------- Bảo trì ---------- */
  @Prop({ type: Number })
  maintenanceCycleMonths?: number;

  @Prop({ type: Date })
  lastMaintenanceDate?: Date;

  @Prop({ type: Date, index: true })
  nextMaintenanceDate?: Date;

  /* ---------- Khác ---------- */
  @Prop({ type: [FileRefSchema], default: [] })
  images: FileRef[];

  @Prop({ type: [FileRefSchema], default: [] })
  attachments: FileRef[];

  @Prop({ type: String })
  notes?: string;

  @Prop({ type: Date })
  disposedAt?: Date;

  @Prop({ type: DisposalInfoSchema })
  disposalInfo?: DisposalInfo;
}

export const AssetSchema = SchemaFactory.createForClass(Asset);
AssetSchema.index(
  { serialNumber: 1 },
  {
    unique: true,
    partialFilterExpression: {
      isActive: true,
      serialNumber: { $type: 'string', $gt: '' },
    },
  },
);

import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';
import { RefType } from '../../../common/constants/system-codes';
import { BaseEntity } from '../../../common/schemas/base.schema';

/** Linh kiện / vật tư thay thế trong kho IT */
@Schema({ timestamps: true })
export class SparePart extends BaseEntity {
  @Prop({ type: String, required: true, uppercase: true, trim: true })
  code: string;

  @Prop({ type: String, required: true, trim: true })
  name: string;

  /** Đơn vị tính: cái, thanh, bộ, hộp... */
  @Prop({ type: String, default: 'cái' })
  unit: string;

  /** Loại thiết bị tương thích */
  @Prop({ type: [{ type: Types.ObjectId, ref: 'AssetCategory' }], default: [] })
  compatibleCategoryIds: Types.ObjectId[];

  /** Thông số: vd "DDR4 8GB 3200MHz" */
  @Prop({ type: String })
  specification?: string;

  @Prop({ type: Number, default: 0, min: 0 })
  quantity: number;

  /** Ngưỡng tồn tối thiểu — dưới ngưỡng sẽ cảnh báo */
  @Prop({ type: Number, default: 0, min: 0 })
  minQuantity: number;

  /** Đơn giá bình quân gia quyền */
  @Prop({ type: Number, default: 0, min: 0 })
  unitPrice: number;

  @Prop({ type: Types.ObjectId, ref: 'Supplier' })
  supplierId?: Types.ObjectId;

  /** Vị trí trong kho: kệ / ngăn */
  @Prop({ type: String })
  storageLocation?: string;

  @Prop({ type: String })
  description?: string;
}
export const SparePartSchema = SchemaFactory.createForClass(SparePart);
SparePartSchema.index(
  { code: 1 },
  { unique: true, partialFilterExpression: { isActive: true } },
);

export enum StockTransactionType {
  IMPORT = 'IMPORT', // Nhập kho
  EXPORT = 'EXPORT', // Xuất dùng cho sửa chữa / bảo trì
  ADJUSTMENT = 'ADJUSTMENT', // Điều chỉnh sau kiểm kê
  RETURN = 'RETURN', // Hoàn trả về kho
}

/** Phiếu nhập / xuất / điều chỉnh kho */
@Schema({ timestamps: { createdAt: true, updatedAt: false } })
export class StockTransaction extends Document {
  @Prop({ type: String, required: true, unique: true })
  code: string;

  @Prop({
    type: String,
    enum: Object.values(StockTransactionType),
    required: true,
    index: true,
  })
  type: StockTransactionType;

  @Prop({ type: Types.ObjectId, ref: 'SparePart', required: true, index: true })
  sparePartId: Types.ObjectId;

  /** Số lượng thay đổi (dương: tăng kho, âm: giảm kho) */
  @Prop({ type: Number, required: true })
  quantityChange: number;

  @Prop({ type: Number, default: 0 })
  unitPrice: number;

  /** Giá trị = |quantityChange| * unitPrice */
  @Prop({ type: Number, default: 0 })
  totalValue: number;

  /** Tồn kho sau giao dịch */
  @Prop({ type: Number, required: true })
  balanceAfter: number;

  @Prop({ type: String, enum: Object.values(RefType) })
  refType?: RefType;

  @Prop({ type: Types.ObjectId, index: true })
  refId?: Types.ObjectId;

  /** Tài sản được thay linh kiện (khi xuất kho) */
  @Prop({ type: Types.ObjectId, ref: 'Asset', index: true })
  assetId?: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'Supplier' })
  supplierId?: Types.ObjectId;

  @Prop({ type: String })
  invoiceNumber?: string;

  @Prop({ type: String })
  note?: string;

  @Prop({ type: Types.ObjectId, ref: 'User' })
  performedBy?: Types.ObjectId;

  createdAt?: Date;
}
export const StockTransactionSchema =
  SchemaFactory.createForClass(StockTransaction);
StockTransactionSchema.index({ createdAt: -1 });

/** Linh kiện đã dùng — nhúng vào ticket / phiếu bảo trì */
@Schema({ _id: false })
export class UsedPart {
  @Prop({ type: Types.ObjectId, ref: 'SparePart', required: true })
  sparePartId: Types.ObjectId;

  @Prop({ type: String })
  code: string;

  @Prop({ type: String })
  name: string;

  @Prop({ type: Number, required: true })
  quantity: number;

  @Prop({ type: Number, default: 0 })
  unitCost: number;

  @Prop({ type: Types.ObjectId, ref: 'StockTransaction' })
  transactionId?: Types.ObjectId;

  @Prop({ type: Date })
  usedAt?: Date;
}
export const UsedPartSchema = SchemaFactory.createForClass(UsedPart);

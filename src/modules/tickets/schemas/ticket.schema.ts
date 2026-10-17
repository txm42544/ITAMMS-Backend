import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Types } from 'mongoose';
import { BaseEntity } from '../../../common/schemas/base.schema';
import { FileRef, FileRefSchema } from '../../assets/schemas/asset.schema';
import { TicketPriority } from '../../catalogs/schemas/catalog.schemas';
import {
  UsedPart,
  UsedPartSchema,
} from '../../spare-parts/schemas/spare-part.schema';

export enum TicketStatus {
  NEW = 'NEW', // Mới báo
  RECEIVED = 'RECEIVED', // Đã tiếp nhận & phân loại
  ASSIGNED = 'ASSIGNED', // Đã phân công KTV
  IN_PROGRESS = 'IN_PROGRESS', // Đang xử lý
  PENDING_APPROVAL = 'PENDING_APPROVAL', // Chờ duyệt đề xuất sửa chữa / thay thế
  RESOLVED = 'RESOLVED', // Đã xử lý, chờ nghiệm thu
  CLOSED = 'CLOSED', // Đã nghiệm thu
  REOPENED = 'REOPENED', // Không đạt, mở lại
  CANCELLED = 'CANCELLED', // Huỷ / từ chối
}

export const OPEN_TICKET_STATUSES = [
  TicketStatus.NEW,
  TicketStatus.RECEIVED,
  TicketStatus.ASSIGNED,
  TicketStatus.IN_PROGRESS,
  TicketStatus.PENDING_APPROVAL,
  TicketStatus.REOPENED,
];

export enum TicketSource {
  WEB = 'WEB',
  QR = 'QR',
}

export enum ResolutionType {
  REPAIRED = 'REPAIRED', // Sửa chữa tại chỗ
  REPLACED_PART = 'REPLACED_PART', // Thay linh kiện
  EXTERNAL_REPAIR = 'EXTERNAL_REPAIR', // Gửi sửa ngoài / bảo hành hãng
  REPLACED_DEVICE = 'REPLACED_DEVICE', // Đổi thiết bị khác
  SOFTWARE = 'SOFTWARE', // Cài đặt / cấu hình phần mềm
  NO_FAULT = 'NO_FAULT', // Không phát hiện lỗi
}

@Schema({ _id: false })
export class TimelineEntry {
  @Prop({ type: String, required: true })
  action: string;

  @Prop({ type: String, enum: Object.values(TicketStatus) })
  status: TicketStatus;

  @Prop({ type: Types.ObjectId, ref: 'User' })
  by?: Types.ObjectId;

  @Prop({ type: String })
  note?: string;

  @Prop({ type: Date, default: () => new Date() })
  at: Date;
}
const TimelineEntrySchema = SchemaFactory.createForClass(TimelineEntry);

@Schema({ _id: false })
export class Acceptance {
  @Prop({ type: Boolean })
  accepted: boolean;

  /** Đánh giá 1-5 sao */
  @Prop({ type: Number, min: 1, max: 5 })
  rating?: number;

  @Prop({ type: String })
  feedback?: string;

  @Prop({ type: Boolean, default: false })
  auto?: boolean;

  @Prop({ type: Date })
  at?: Date;
}
const AcceptanceSchema = SchemaFactory.createForClass(Acceptance);

@Schema({ timestamps: true })
export class Ticket extends BaseEntity {
  @Prop({ type: String, required: true, unique: true })
  code: string;

  @Prop({ type: Types.ObjectId, ref: 'Asset', index: true })
  assetId?: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'User', required: true, index: true })
  reportedBy: Types.ObjectId;

  /** Phòng ban liên quan (của tài sản hoặc người báo) — phục vụ lọc theo phòng ban */
  @Prop({ type: Types.ObjectId, ref: 'Department', index: true })
  departmentId?: Types.ObjectId;

  @Prop({
    type: String,
    enum: Object.values(TicketSource),
    default: TicketSource.WEB,
  })
  source: TicketSource;

  @Prop({ type: String, required: true, trim: true })
  title: string;

  @Prop({ type: String })
  description?: string;

  @Prop({ type: [FileRefSchema], default: [] })
  images: FileRef[];

  @Prop({ type: Types.ObjectId, ref: 'IncidentType', index: true })
  incidentTypeId?: Types.ObjectId;

  @Prop({
    type: String,
    enum: Object.values(TicketPriority),
    default: TicketPriority.MEDIUM,
    index: true,
  })
  priority: TicketPriority;

  @Prop({
    type: String,
    enum: Object.values(TicketStatus),
    default: TicketStatus.NEW,
    index: true,
  })
  status: TicketStatus;

  /* ---------- Tiếp nhận & phân công ---------- */
  @Prop({ type: Types.ObjectId, ref: 'User' })
  receivedBy?: Types.ObjectId;

  @Prop({ type: Date })
  receivedAt?: Date;

  @Prop({ type: Types.ObjectId, ref: 'User', index: true })
  assigneeId?: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'User' })
  assignedBy?: Types.ObjectId;

  @Prop({ type: Date })
  assignedAt?: Date;

  /** Hạn xử lý theo SLA của loại sự cố */
  @Prop({ type: Date, index: true })
  dueAt?: Date;

  /* ---------- Xử lý ---------- */
  @Prop({ type: Date })
  startedAt?: Date;

  /** Kết quả kiểm tra thiết bị */
  @Prop({ type: String })
  diagnosis?: string;

  @Prop({ type: String })
  rootCause?: string;

  @Prop({ type: String, enum: Object.values(ResolutionType) })
  resolutionType?: ResolutionType;

  @Prop({ type: String })
  resolution?: string;

  @Prop({ type: [UsedPartSchema], default: [] })
  partsUsed: UsedPart[];

  @Prop({ type: Number, default: 0 })
  partsCost: number;

  @Prop({ type: Number, default: 0 })
  laborCost: number;

  /** Chi phí thuê ngoài / gửi hãng */
  @Prop({ type: Number, default: 0 })
  externalCost: number;

  @Prop({ type: Number, default: 0 })
  totalCost: number;

  @Prop({ type: Date })
  resolvedAt?: Date;

  /* ---------- Nghiệm thu ---------- */
  @Prop({ type: AcceptanceSchema })
  acceptance?: Acceptance;

  @Prop({ type: Date })
  closedAt?: Date;

  @Prop({ type: Number, default: 0 })
  reopenCount: number;

  /** Đã quá hạn SLA khi xử lý xong */
  @Prop({ type: Boolean, default: false })
  slaBreached: boolean;

  @Prop({ type: String })
  cancelReason?: string;

  @Prop({ type: [TimelineEntrySchema], default: [] })
  timeline: TimelineEntry[];
}

export const TicketSchema = SchemaFactory.createForClass(Ticket);
TicketSchema.index({ status: 1, dueAt: 1 });
TicketSchema.index({ createdAt: -1 });

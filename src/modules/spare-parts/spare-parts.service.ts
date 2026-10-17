import {
  BadRequestException,
  HttpStatus,
  Injectable,
  Logger,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { PERMISSIONS } from '../../common/constants/permissions.constant';
import { RefType } from '../../common/constants/system-codes';
import { CounterService } from '../../common/counters/counter.service';
import { BaseCrudService } from '../../common/services/base-crud.service';
import { combineFilters } from '../../common/utils/data-scope.util';
import { applyDateRange, paginate } from '../../common/utils/paginate.util';
import { buildSearchFilter } from '../../common/utils/regex.util';
import { createApiResponse } from '../../common/utils/response.util';
import { SuppliersService } from '../catalogs/services/suppliers.service';
import { NotificationType } from '../notifications/schemas/notification.schema';
import { NotificationsService } from '../notifications/notifications.service';
import {
  AdjustStockDto,
  CreateSparePartDto,
  ImportStockDto,
  SparePartQueryDto,
  StockTransactionQueryDto,
  UpdateSparePartDto,
  UsePartItemDto,
} from './dto/spare-part.dto';
import {
  SparePart,
  StockTransaction,
  StockTransactionType,
  UsedPart,
} from './schemas/spare-part.schema';

export interface ConsumeContext {
  refType: RefType;
  refId: any;
  assetId?: any;
  performedBy: string;
  note?: string;
}

const PART_POPULATE = [
  { path: 'supplierId', select: 'code name' },
  { path: 'compatibleCategoryIds', select: 'code name' },
];

@Injectable()
export class SparePartsService extends BaseCrudService<SparePart> {
  private readonly logger = new Logger(SparePartsService.name);

  constructor(
    @InjectModel(SparePart.name) model: Model<SparePart>,
    @InjectModel(StockTransaction.name)
    private readonly transactionModel: Model<StockTransaction>,
    private readonly counterService: CounterService,
    private readonly suppliersService: SuppliersService,
    private readonly notificationsService: NotificationsService,
  ) {
    super(model, {
      entityName: 'linh kiện',
      searchFields: ['code', 'name', 'specification'],
      uniqueFields: ['code'],
      populate: PART_POPULATE,
      defaultSort: { code: 1 },
      optionFields: 'code name unit quantity unitPrice compatibleCategoryIds',
    });
  }

  protected buildFilter(query: SparePartQueryDto) {
    const filter: Record<string, any> = {};
    if (query.categoryId) {
      filter.compatibleCategoryIds = new Types.ObjectId(query.categoryId);
    }
    if (query.lowStock === 'true') {
      filter.$expr = { $lte: ['$quantity', '$minQuantity'] };
    }
    return filter;
  }

  async create(dto: CreateSparePartDto, userId: string) {
    if (dto.supplierId) await this.suppliersService.findEntity(dto.supplierId);
    const { initialQuantity, ...rest } = dto;
    const res = await super.create(
      { ...rest, code: dto.code.toUpperCase(), quantity: 0 },
      userId,
    );
    if (initialQuantity && initialQuantity > 0) {
      await this.importStock(
        String(res.data._id),
        {
          quantity: initialQuantity,
          unitPrice: dto.unitPrice ?? 0,
          supplierId: dto.supplierId,
          note: 'Tồn đầu kỳ',
        },
        userId,
      );
    }
    return this.findOne(String(res.data._id)).then((r) => ({
      ...r,
      statusCode: HttpStatus.CREATED,
      message: res.message,
    }));
  }

  async update(id: string, dto: UpdateSparePartDto, userId: string) {
    if (dto.supplierId) await this.suppliersService.findEntity(dto.supplierId);
    return super.update(
      id,
      dto.code ? { ...dto, code: dto.code.toUpperCase() } : dto,
      userId,
    );
  }

  protected async beforeRemove(entity: SparePart) {
    if (entity.quantity > 0) {
      throw new BadRequestException(
        'Linh kiện còn tồn kho, hãy điều chỉnh về 0 trước khi xoá',
      );
    }
  }

  /* =============================== Nhập / điều chỉnh =============================== */

  async importStock(id: string, dto: ImportStockDto, userId: string) {
    const part = await this.findEntity(id);
    if (dto.supplierId) await this.suppliersService.findEntity(dto.supplierId);

    // Đơn giá bình quân gia quyền
    const newQty = part.quantity + dto.quantity;
    const avgPrice = Math.round(
      (part.quantity * part.unitPrice + dto.quantity * dto.unitPrice) / newQty,
    );
    const updated = await this.model.findOneAndUpdate(
      { _id: id, isActive: true },
      {
        $inc: { quantity: dto.quantity },
        $set: { unitPrice: avgPrice, updatedBy: userId },
      },
      { new: true },
    );
    const tx = await this.createTransaction({
      type: StockTransactionType.IMPORT,
      sparePartId: part._id,
      quantityChange: dto.quantity,
      unitPrice: dto.unitPrice,
      balanceAfter: updated.quantity,
      supplierId: dto.supplierId,
      invoiceNumber: dto.invoiceNumber,
      note: dto.note,
      performedBy: userId,
    });
    return createApiResponse(
      { sparePart: updated, transaction: tx },
      `Nhập kho ${dto.quantity} ${part.unit} thành công`,
    );
  }

  async adjustStock(id: string, dto: AdjustStockDto, userId: string) {
    const part = await this.findEntity(id);
    const diff = dto.actualQuantity - part.quantity;
    if (diff === 0) {
      throw new BadRequestException(
        'Số lượng thực tế trùng với tồn kho hiện tại',
      );
    }
    const updated = await this.model.findOneAndUpdate(
      { _id: id, quantity: part.quantity },
      { $set: { quantity: dto.actualQuantity, updatedBy: userId } },
      { new: true },
    );
    if (!updated) {
      throw new BadRequestException('Tồn kho vừa thay đổi, vui lòng thử lại');
    }
    const tx = await this.createTransaction({
      type: StockTransactionType.ADJUSTMENT,
      sparePartId: part._id,
      quantityChange: diff,
      unitPrice: part.unitPrice,
      balanceAfter: updated.quantity,
      note: dto.note,
      performedBy: userId,
    });
    await this.checkLowStock([updated]);
    return createApiResponse(
      { sparePart: updated, transaction: tx },
      'Điều chỉnh tồn kho thành công',
    );
  }

  /* =============================== Xuất kho (dùng bởi ticket / bảo trì) =============================== */

  /**
   * Trừ kho atomic cho nhiều linh kiện. Nếu 1 linh kiện không đủ hàng,
   * hoàn trả các linh kiện đã trừ trước đó và ném lỗi.
   */
  async consume(
    items: UsePartItemDto[],
    ctx: ConsumeContext,
  ): Promise<UsedPart[]> {
    const merged = new Map<string, number>();
    for (const i of items) {
      merged.set(i.sparePartId, (merged.get(i.sparePartId) ?? 0) + i.quantity);
    }

    const done: { part: SparePart; qty: number }[] = [];
    try {
      for (const [id, qty] of merged) {
        const part = await this.model.findOneAndUpdate(
          { _id: id, isActive: true, quantity: { $gte: qty } },
          { $inc: { quantity: -qty } },
          { new: true },
        );
        if (!part) {
          const current = await this.model
            .findById(id)
            .select('code name quantity unit');
          throw new BadRequestException(
            current
              ? `Linh kiện ${current.code} - ${current.name} không đủ tồn kho (còn ${current.quantity} ${current.unit})`
              : 'Linh kiện không tồn tại',
          );
        }
        done.push({ part, qty });
      }
    } catch (error) {
      await Promise.all(
        done.map(({ part, qty }) =>
          this.model.updateOne({ _id: part._id }, { $inc: { quantity: qty } }),
        ),
      );
      throw error;
    }

    const now = new Date();
    const used: UsedPart[] = [];
    for (const { part, qty } of done) {
      const tx = await this.createTransaction({
        type: StockTransactionType.EXPORT,
        sparePartId: part._id,
        quantityChange: -qty,
        unitPrice: part.unitPrice,
        balanceAfter: part.quantity,
        refType: ctx.refType,
        refId: ctx.refId,
        assetId: ctx.assetId,
        note: ctx.note,
        performedBy: ctx.performedBy,
      });
      used.push({
        sparePartId: part._id as Types.ObjectId,
        code: part.code,
        name: part.name,
        quantity: qty,
        unitCost: part.unitPrice,
        transactionId: tx._id as Types.ObjectId,
        usedAt: now,
      });
    }
    await this.checkLowStock(done.map((d) => d.part));
    return used;
  }

  /* =============================== Truy vấn =============================== */

  async findLowStock() {
    const data = await this.model
      .find({ isActive: true, $expr: { $lte: ['$quantity', '$minQuantity'] } })
      .populate(PART_POPULATE)
      .sort({ quantity: 1 })
      .lean();
    return createApiResponse(
      data,
      'Lấy danh sách linh kiện tồn thấp thành công',
    );
  }

  async findTransactions(query: StockTransactionQueryDto) {
    const filter: Record<string, any> = {};
    for (const key of ['sparePartId', 'refId', 'assetId'] as const) {
      if (query[key]) filter[key] = new Types.ObjectId(query[key]);
    }
    if (query.type) filter.type = query.type;
    if (query.refType) filter.refType = query.refType;
    applyDateRange(filter, 'createdAt', query.fromDate, query.toDate);

    return paginate(
      this.transactionModel,
      combineFilters(
        filter,
        buildSearchFilter(query.search, ['code', 'note', 'invoiceNumber']),
      ),
      query,
      {
        populate: [
          { path: 'sparePartId', select: 'code name unit' },
          { path: 'assetId', select: 'assetCode name' },
          { path: 'supplierId', select: 'code name' },
          { path: 'performedBy', select: 'employeeCode fullName' },
        ],
        message: 'Lấy lịch sử nhập xuất kho thành công',
      },
    );
  }

  /* =============================== Helpers =============================== */

  private async createTransaction(
    data: Record<string, any> & { quantityChange: number; unitPrice?: number },
  ) {
    return this.transactionModel.create({
      ...data,
      code: await this.counterService.nextCode('PK', { period: 'MONTH' }),
      totalValue: Math.abs(data.quantityChange) * (data.unitPrice ?? 0),
    });
  }

  private async checkLowStock(parts: SparePart[]) {
    const low = parts.filter((p) => p.quantity <= p.minQuantity);
    for (const p of low) {
      await this.notificationsService.notifyPermission(
        PERMISSIONS.SPARE_PART_MANAGE,
        {
          type: NotificationType.LOW_STOCK,
          title: `Linh kiện ${p.code} sắp hết (còn ${p.quantity} ${p.unit})`,
          content: `${p.name} — ngưỡng tối thiểu ${p.minQuantity}`,
          refType: RefType.SPARE_PART,
          refId: p._id,
        },
      );
    }
  }
}

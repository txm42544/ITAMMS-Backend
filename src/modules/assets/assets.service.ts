import {
  BadRequestException,
  ConflictException,
  HttpStatus,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectConnection, InjectModel } from '@nestjs/mongoose';
import { randomBytes } from 'crypto';
import { Connection, Model, Types } from 'mongoose';
import { PERMISSIONS } from '../../common/constants/permissions.constant';
import {
  SettingKey,
  SystemAssetStatus,
} from '../../common/constants/system-codes';
import { CounterService } from '../../common/counters/counter.service';
import { AuthUser } from '../../common/interfaces/auth-user.interface';
import {
  buildScopeFilter,
  combineFilters,
} from '../../common/utils/data-scope.util';
import {
  addDays,
  addInterval,
  applyDateRange,
  paginate,
} from '../../common/utils/paginate.util';
import { hasPermission } from '../../common/utils/permission.util';
import { ensureNotReferenced } from '../../common/utils/reference.util';
import { buildSearchFilter } from '../../common/utils/regex.util';
import { createApiResponse } from '../../common/utils/response.util';
import { AssetStatus } from '../catalogs/schemas/catalog.schemas';
import { AssetCategoriesService } from '../catalogs/services/asset-categories.service';
import { AssetStatusesService } from '../catalogs/services/asset-statuses.service';
import { LocationsService } from '../catalogs/services/locations.service';
import { SettingsService } from '../catalogs/services/settings.service';
import { SuppliersService } from '../catalogs/services/suppliers.service';
import { DepartmentsService } from '../departments/departments.service';
import { MaintenanceTask } from '../maintenance/schemas/maintenance.schemas';
import { RepairRequest } from '../tickets/schemas/repair-request.schema';
import { Ticket } from '../tickets/schemas/ticket.schema';
import { UsersService } from '../users/users.service';
import { AssetHistoryService } from './asset-history.service';
import {
  AssetHistoryQueryDto,
  AssetQueryDto,
  ChangeAssetStatusDto,
  CreateAssetDto,
  UpdateAssetDto,
} from './dto/asset.dto';
import { AssetHistoryAction } from './schemas/asset-history.schema';
import { Asset } from './schemas/asset.schema';

export const ASSET_POPULATE = [
  { path: 'categoryId', select: 'code name codePrefix specFields' },
  { path: 'statusId', select: 'code name color isFinal allowAssign' },
  { path: 'departmentId', select: 'code name' },
  { path: 'locationId', select: 'code name building floor room' },
  { path: 'currentUserId', select: 'employeeCode fullName email phone' },
  { path: 'supplierId', select: 'code name phone email' },
];

export const ASSET_SEARCH_FIELDS = [
  'assetCode',
  'name',
  'serialNumber',
  'deviceModel',
  'brand',
];

const SERVICE_STATUSES: string[] = [
  SystemAssetStatus.UNDER_REPAIR,
  SystemAssetStatus.UNDER_MAINTENANCE,
];

@Injectable()
export class AssetsService {
  /** Model phụ trợ (lấy từ connection) — typed optional vì không phải mọi môi trường đều có */
  private ticketModel: Model<Ticket> | undefined;
  private maintenanceTaskModel: Model<MaintenanceTask> | undefined;
  private repairRequestModel: Model<RepairRequest> | undefined;

  constructor(
    @InjectModel(Asset.name) private readonly assetModel: Model<Asset>,
    @InjectConnection() private readonly connection: Connection,
    private readonly historyService: AssetHistoryService,
    private readonly counterService: CounterService,
    private readonly categoriesService: AssetCategoriesService,
    private readonly statusesService: AssetStatusesService,
    private readonly locationsService: LocationsService,
    private readonly suppliersService: SuppliersService,
    private readonly departmentsService: DepartmentsService,
    private readonly usersService: UsersService,
    private readonly settingsService: SettingsService,
  ) {
    // Lấy model Ticket / MaintenanceTask / RepairRequest từ connection đã đăng ký
    // trong TicketsModule / MaintenanceModule — không inject vì AssetsModule global
    // và tránh phụ thuộc vòng giữa các module.
    this.ticketModel = this.connection.model(Ticket.name) as Model<Ticket>;
    this.maintenanceTaskModel = this.connection.model(
      MaintenanceTask.name,
    ) as Model<MaintenanceTask>;
    this.repairRequestModel = this.connection.model(
      RepairRequest.name,
    ) as Model<RepairRequest>;
  }

  /** Trả về giá trị rỗng khi collection chưa được đăng ký trong connection (an toàn) */
  private getTicketModel() {
    return this.ticketModel ?? null;
  }
  private getMaintenanceModel() {
    return this.maintenanceTaskModel ?? null;
  }
  private getRepairModel() {
    return this.repairRequestModel ?? null;
  }

  /* =============================== Truy vấn =============================== */

  scopeFilter(user: AuthUser) {
    return buildScopeFilter(user, {
      allPermission: PERMISSIONS.ASSET_READ_ALL,
      departmentPermission: PERMISSIONS.ASSET_READ_DEPARTMENT,
      ownFilter: (userId) => ({ currentUserId: userId }),
    });
  }

  /** Kiểm tra user có quyền xem tài sản cụ thể hay không */
  canView(asset: Asset, user: AuthUser): boolean {
    if (hasPermission(user, PERMISSIONS.ASSET_READ_ALL)) return true;
    const refId = (v: any) => (v?._id ?? v)?.toString();
    if (refId(asset.currentUserId) === user.id) return true;
    return (
      hasPermission(user, PERMISSIONS.ASSET_READ_DEPARTMENT) &&
      !!user.departmentId &&
      refId(asset.departmentId) === user.departmentId
    );
  }

  async buildListFilter(query: AssetQueryDto, user: AuthUser) {
    const filter: Record<string, any> = { isActive: true };
    for (const key of [
      'categoryId',
      'statusId',
      'departmentId',
      'locationId',
      'currentUserId',
      'supplierId',
    ] as const) {
      if (query[key]) filter[key] = new Types.ObjectId(query[key]);
    }
    if (query.statusCode) {
      filter.statusId =
        (await this.statusesService.findIdByCode(query.statusCode)) ??
        new Types.ObjectId();
    }

    const now = new Date();
    if (query.warranty) {
      const days = await this.settingsService.get<number>(
        SettingKey.WARRANTY_ALERT_DAYS,
      );
      const soon = addDays(now, days);
      if (query.warranty === 'valid') filter.warrantyEndDate = { $gt: now };
      if (query.warranty === 'expiring') {
        filter.warrantyEndDate = { $gte: now, $lte: soon };
      }
      if (query.warranty === 'expired') filter.warrantyEndDate = { $lt: now };
      if (query.warranty === 'none') filter.warrantyEndDate = null;
    }
    if (query.maintenanceDue === 'true') {
      filter.nextMaintenanceDate = { $lte: addDays(now, 30) };
    }
    applyDateRange(filter, 'purchaseDate', query.fromDate, query.toDate);

    return combineFilters(
      filter,
      buildSearchFilter(query.search, ASSET_SEARCH_FIELDS),
      this.scopeFilter(user),
    );
  }

  async findAll(query: AssetQueryDto, user: AuthUser) {
    const filter = await this.buildListFilter(query, user);
    return paginate(this.assetModel, filter, query, {
      populate: ASSET_POPULATE,
      message: 'Lấy danh sách tài sản thành công',
    });
  }

  async findMine(userId: string, query: AssetQueryDto) {
    const filter = combineFilters(
      { isActive: true, currentUserId: new Types.ObjectId(userId) },
      buildSearchFilter(query.search, ASSET_SEARCH_FIELDS),
    );
    return paginate(this.assetModel, filter, query, {
      populate: ASSET_POPULATE,
      message: 'Lấy danh sách tài sản đang sử dụng thành công',
    });
  }

  async findOne(id: string, user: AuthUser) {
    const asset = await this.assetModel
      .findOne(
        combineFilters({ _id: id, isActive: true }, this.scopeFilter(user)),
      )
      .populate(ASSET_POPULATE)
      .lean();
    if (!asset) {
      throw new NotFoundException(
        'Không tìm thấy tài sản hoặc bạn không có quyền xem',
      );
    }
    return createApiResponse(asset, 'Lấy thông tin tài sản thành công');
  }

  async getHistory(id: string, query: AssetHistoryQueryDto, user: AuthUser) {
    const asset = await this.getActiveAsset(id);
    if (!this.canView(asset, user)) {
      throw new NotFoundException(
        'Không tìm thấy tài sản hoặc bạn không có quyền xem',
      );
    }
    return this.historyService.findByAsset(id, query);
  }

  /** Lịch sử bảo trì (MaintenanceTask) của tài sản */
  async getMaintenanceHistory(id: string, user: AuthUser) {
    const asset = await this.getActiveAsset(id);
    if (!this.canView(asset, user)) {
      throw new NotFoundException(
        'Không tìm thấy tài sản hoặc bạn không có quyền xem',
      );
    }
    const taskModel = this.getMaintenanceModel();
    if (!taskModel) {
      return createApiResponse([], 'Lấy lịch sử bảo trì thành công');
    }
    const filter = { isActive: true, assetId: new Types.ObjectId(id) };
    return paginate(taskModel, filter, { page: 1, limit: 50 } as any, {
      populate: [
        { path: 'planId', select: 'code name' },
        { path: 'assigneeId', select: 'employeeCode fullName' },
        { path: 'completedBy', select: 'employeeCode fullName' },
      ],
      defaultSort: { scheduledDate: -1 },
      message: 'Lấy lịch sử bảo trì của tài sản thành công',
    });
  }

  /** Lịch sử sửa chữa (Ticket + RepairRequest) của tài sản */
  async getRepairHistory(id: string, user: AuthUser) {
    const asset = await this.getActiveAsset(id);
    if (!this.canView(asset, user)) {
      throw new NotFoundException(
        'Không tìm thấy tài sản hoặc bạn không có quyền xem',
      );
    }
    const ticketModel = this.getTicketModel();
    if (!ticketModel) {
      return createApiResponse([], 'Lấy lịch sử sửa chữa thành công');
    }
    const filter = {
      isActive: true,
      assetId: new Types.ObjectId(id),
    };
    return paginate(ticketModel, filter, { page: 1, limit: 50 } as any, {
      populate: [
        {
          path: 'assetId',
          select: 'assetCode name categoryId statusId departmentId',
        },
        { path: 'reportedBy', select: 'employeeCode fullName' },
        { path: 'assigneeId', select: 'employeeCode fullName' },
        {
          path: 'incidentTypeId',
          select: 'code name defaultPriority',
        },
      ],
      select: '-timeline',
      defaultSort: { createdAt: -1 },
      message: 'Lấy lịch sử sửa chữa của tài sản thành công',
    });
  }

  /* =============================== Ghi dữ liệu =============================== */

  async create(dto: CreateAssetDto, user: AuthUser) {
    const category = await this.categoriesService.findEntity(dto.categoryId);
    await this.validateRefs(dto);
    await this.ensureSerialUnique(dto.serialNumber);

    let status = dto.statusId
      ? await this.statusesService.findEntity(dto.statusId)
      : await this.statusesService.getByCode(SystemAssetStatus.IN_STOCK);
    if (status.isFinal) {
      throw new BadRequestException(
        'Không thể tạo tài sản ở trạng thái đã thanh lý',
      );
    }

    let departmentId = dto.departmentId;
    if (dto.currentUserId) {
      const holder = await this.usersService.getActiveUser(dto.currentUserId);
      departmentId = departmentId || holder.departmentId?.toString();
      if (status.code === SystemAssetStatus.IN_STOCK) {
        status = await this.statusesService.getByCode(SystemAssetStatus.IN_USE);
      }
    }

    const purchaseDate = dto.purchaseDate
      ? new Date(dto.purchaseDate)
      : undefined;
    const warrantyStartDate = dto.warrantyStartDate
      ? new Date(dto.warrantyStartDate)
      : purchaseDate;
    const warrantyEndDate = dto.warrantyEndDate
      ? new Date(dto.warrantyEndDate)
      : dto.warrantyMonths && warrantyStartDate
        ? addInterval(warrantyStartDate, dto.warrantyMonths, 'MONTH')
        : undefined;
    const cycle =
      dto.maintenanceCycleMonths ?? category.defaultMaintenanceCycleMonths;

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { warrantyMonths, ...rest } = dto;
    const asset = await this.assetModel.create({
      ...rest,
      departmentId,
      assetCode: await this.counterService.nextCode(category.codePrefix, {
        period: 'YEAR',
      }),
      qrToken: AssetsService.generateQrToken(),
      statusId: status._id,
      warrantyStartDate,
      warrantyEndDate,
      maintenanceCycleMonths: cycle,
      nextMaintenanceDate: cycle
        ? AssetsService.nextOccurrence(purchaseDate || new Date(), cycle)
        : undefined,
      assignedAt: dto.currentUserId ? new Date() : undefined,
      createdBy: user.id,
    });

    await this.historyService.log({
      assetId: asset._id,
      action: AssetHistoryAction.CREATED,
      description: `Nhập tài sản mới ${asset.assetCode}`,
      toStatusId: status._id as any,
      toDepartmentId: asset.departmentId,
      toLocationId: asset.locationId,
      cost: asset.purchasePrice,
      performedBy: user.id,
    });
    if (asset.currentUserId) {
      await this.historyService.log({
        assetId: asset._id,
        action: AssetHistoryAction.ASSIGNED,
        description: 'Ghi nhận người sử dụng khi nhập liệu ban đầu',
        toUserId: asset.currentUserId,
        toDepartmentId: asset.departmentId,
        performedBy: user.id,
      });
    }

    const result = await this.assetModel
      .findById(asset._id)
      .populate(ASSET_POPULATE)
      .lean();
    return createApiResponse(
      result,
      'Thêm tài sản thành công',
      HttpStatus.CREATED,
    );
  }

  async update(id: string, dto: UpdateAssetDto, user: AuthUser) {
    const asset = await this.getActiveAsset(id);
    await this.ensureNotFinal(asset);
    await this.validateRefs(dto);
    if (dto.categoryId) await this.categoriesService.findEntity(dto.categoryId);
    if (dto.serialNumber !== undefined) {
      await this.ensureSerialUnique(dto.serialNumber, id);
    }

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { warrantyMonths, ...rest } = dto;
    const update: Record<string, any> = { ...rest };
    if (dto.warrantyMonths && !dto.warrantyEndDate) {
      const start =
        (dto.warrantyStartDate && new Date(dto.warrantyStartDate)) ||
        asset.warrantyStartDate ||
        asset.purchaseDate;
      if (start) {
        update.warrantyEndDate = addInterval(
          start,
          dto.warrantyMonths,
          'MONTH',
        );
      }
    }
    if (
      dto.maintenanceCycleMonths &&
      dto.maintenanceCycleMonths !== asset.maintenanceCycleMonths
    ) {
      update.nextMaintenanceDate = AssetsService.nextOccurrence(
        asset.lastMaintenanceDate || asset.purchaseDate || new Date(),
        dto.maintenanceCycleMonths,
      );
    }

    const changes = AssetsService.diff(asset, update);
    if (!Object.keys(changes).length) {
      return this.findOne(id, user);
    }

    const fromLocationId = asset.locationId;
    asset.set({ ...update, updatedBy: user.id });
    await asset.save();

    await this.historyService.log({
      assetId: asset._id,
      action: AssetHistoryAction.UPDATED,
      description: `Cập nhật thông tin: ${Object.keys(changes).join(', ')}`,
      changes,
      ...(changes.locationId && {
        fromLocationId,
        toLocationId: asset.locationId,
      }),
      performedBy: user.id,
    });
    return this.findOne(id, user).then((r) => ({
      ...r,
      message: 'Cập nhật tài sản thành công',
    }));
  }

  async changeStatus(id: string, dto: ChangeAssetStatusDto, user: AuthUser) {
    const asset = await this.getActiveAsset(id);
    await this.ensureNotFinal(asset);
    const status = await this.statusesService.findEntity(dto.statusId);
    if (status.isFinal) {
      throw new BadRequestException(
        'Thanh lý tài sản phải thực hiện qua yêu cầu thanh lý',
      );
    }
    if (String(asset.statusId) === String(status._id)) {
      throw new BadRequestException('Tài sản đã ở trạng thái này');
    }
    const fromStatusId = asset.statusId;
    asset.statusId = status._id as Types.ObjectId;
    asset.updatedBy = user.id as any;
    await asset.save();
    await this.historyService.log({
      assetId: asset._id,
      action: AssetHistoryAction.STATUS_CHANGED,
      description: dto.note || `Chuyển trạng thái sang "${status.name}"`,
      fromStatusId,
      toStatusId: asset.statusId,
      performedBy: user.id,
    });
    return this.findOne(id, user).then((r) => ({
      ...r,
      message: 'Cập nhật trạng thái thành công',
    }));
  }

  async remove(id: string, user: AuthUser) {
    const asset = await this.getActiveAsset(id);
    if (asset.currentUserId) {
      throw new ConflictException(
        'Tài sản đang được sử dụng, cần thu hồi trước khi xoá',
      );
    }
    await ensureNotReferenced(this.connection, asset._id, [
      {
        model: 'Ticket',
        field: 'assetId',
        label: 'sự cố chưa đóng',
        extra: { status: { $nin: ['CLOSED', 'CANCELLED'] } },
      },
      {
        model: 'AssetRequest',
        field: 'assetIds',
        label: 'yêu cầu vòng đời đang xử lý',
        extra: { status: { $in: ['PENDING', 'APPROVED'] } },
      },
    ]);
    asset.isActive = false;
    asset.updatedBy = user.id as any;
    await asset.save();
    return createApiResponse(null, 'Xoá tài sản thành công');
  }

  /* =============================== Dùng chung cho module khác =============================== */

  async getActiveAsset(id: string | Types.ObjectId) {
    const asset = await this.assetModel.findOne({ _id: id, isActive: true });
    if (!asset) throw new NotFoundException('Không tìm thấy tài sản');
    return asset;
  }

  async ensureNotFinal(asset: Asset): Promise<AssetStatus> {
    const status = await this.statusesService.findEntity(
      String(asset.statusId),
    );
    if (status.isFinal) {
      throw new BadRequestException(
        `Tài sản ${asset.assetCode} đã thanh lý, không thể thao tác`,
      );
    }
    return status;
  }

  /**
   * Đưa tài sản vào trạng thái sửa chữa / bảo trì, lưu trạng thái cũ để khôi phục.
   * Trả về { fromStatusId, toStatusId } để ghi lịch sử.
   */
  async moveToService(
    asset: Asset,
    code: SystemAssetStatus.UNDER_REPAIR | SystemAssetStatus.UNDER_MAINTENANCE,
  ) {
    const target = await this.statusesService.getIdByCode(code);
    const fromStatusId = asset.statusId;
    if (String(fromStatusId) === String(target)) {
      return { fromStatusId, toStatusId: target, changed: false };
    }
    const current = await this.statusesService.findEntity(String(fromStatusId));
    if (!SERVICE_STATUSES.includes(current.code)) {
      asset.statusBeforeService = fromStatusId;
    }
    asset.statusId = target;
    await asset.save();
    return { fromStatusId, toStatusId: target, changed: true };
  }

  /** Khôi phục trạng thái sau khi sửa chữa / bảo trì xong */
  async restoreFromService(asset: Asset) {
    const current = await this.statusesService.findEntity(
      String(asset.statusId),
    );
    if (!SERVICE_STATUSES.includes(current.code)) {
      return {
        fromStatusId: asset.statusId,
        toStatusId: asset.statusId,
        changed: false,
      };
    }
    const fromStatusId = asset.statusId;
    asset.statusId =
      asset.statusBeforeService ||
      (await this.statusesService.getIdByCode(
        asset.currentUserId
          ? SystemAssetStatus.IN_USE
          : SystemAssetStatus.IN_STOCK,
      ));
    asset.statusBeforeService = undefined;
    await asset.save();
    return { fromStatusId, toStatusId: asset.statusId, changed: true };
  }

  /* =============================== Helpers =============================== */

  static generateQrToken() {
    return randomBytes(12).toString('base64url');
  }

  /** Ngày đến hạn kế tiếp >= hôm nay, tính từ mốc base theo chu kỳ tháng */
  static nextOccurrence(base: Date, cycleMonths: number): Date {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    let next = addInterval(base, cycleMonths, 'MONTH');
    while (next < today) next = addInterval(next, cycleMonths, 'MONTH');
    return next;
  }

  private static diff(asset: Asset, update: Record<string, any>) {
    const changes: Record<string, { from: any; to: any }> = {};
    const norm = (v: any) => {
      if (v === undefined || v === null || v === '') return null;
      if (v instanceof Date) return v.toISOString();
      if (v instanceof Types.ObjectId) return v.toString();
      if (typeof v === 'string' && /^\d{4}-\d{2}-\d{2}/.test(v)) {
        return new Date(v).toISOString();
      }
      return typeof v === 'object' ? JSON.stringify(v) : v;
    };
    for (const [key, value] of Object.entries(update)) {
      const current = (asset as any).get ? asset.get(key) : asset[key];
      if (norm(current) !== norm(value)) {
        changes[key] = {
          from: ['images', 'attachments'].includes(key)
            ? `${current?.length ?? 0} file`
            : current,
          to: ['images', 'attachments'].includes(key)
            ? `${value?.length ?? 0} file`
            : value,
        };
      }
    }
    return changes;
  }

  private async validateRefs(dto: Partial<CreateAssetDto>) {
    if (dto.supplierId) await this.suppliersService.findEntity(dto.supplierId);
    if (dto.locationId) await this.locationsService.findEntity(dto.locationId);
    if (dto.departmentId) {
      await this.departmentsService.findEntity(dto.departmentId);
    }
  }

  private async ensureSerialUnique(serial?: string, excludeId?: string) {
    if (!serial) return;
    const filter: any = { serialNumber: serial, isActive: true };
    if (excludeId) filter._id = { $ne: excludeId };
    if (await this.assetModel.exists(filter)) {
      throw new ConflictException(`Số serial "${serial}" đã tồn tại`);
    }
  }
}

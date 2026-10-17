import { BadRequestException, HttpStatus, Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import {
  SettingKey,
  SystemAssetStatus,
} from '../../common/constants/system-codes';
import { CounterService } from '../../common/counters/counter.service';
import { BaseCrudService } from '../../common/services/base-crud.service';
import { createApiResponse } from '../../common/utils/response.util';
import { Asset } from '../assets/schemas/asset.schema';
import { AssetStatusesService } from '../catalogs/services/asset-statuses.service';
import { SettingsService } from '../catalogs/services/settings.service';
import { UsersService } from '../users/users.service';
import {
  CreateMaintenancePlanDto,
  MaintenancePlanQueryDto,
  PlanScopeDto,
  UpdateMaintenancePlanDto,
} from './dto/maintenance.dto';
import {
  MaintenancePlan,
  MaintenanceTask,
  OPEN_TASK_STATUSES,
} from './schemas/maintenance.schemas';

@Injectable()
export class MaintenancePlansService extends BaseCrudService<MaintenancePlan> {
  constructor(
    @InjectModel(MaintenancePlan.name) model: Model<MaintenancePlan>,
    @InjectModel(Asset.name) private readonly assetModel: Model<Asset>,
    @InjectModel(MaintenanceTask.name)
    private readonly taskModel: Model<MaintenanceTask>,
    private readonly counterService: CounterService,
    private readonly statusesService: AssetStatusesService,
    private readonly settingsService: SettingsService,
    private readonly usersService: UsersService,
  ) {
    super(model, {
      entityName: 'kế hoạch bảo trì',
      searchFields: ['code', 'name'],
      populate: [
        { path: 'scope.categoryIds', select: 'code name' },
        { path: 'scope.departmentIds', select: 'code name' },
        { path: 'scope.assetIds', select: 'assetCode name' },
        { path: 'defaultAssigneeId', select: 'employeeCode fullName' },
      ],
      defaultSort: { nextRunDate: 1 },
      optionFields: 'code name nextRunDate',
    });
  }

  protected buildFilter(query: MaintenancePlanQueryDto) {
    return query.isPaused ? { isPaused: query.isPaused === 'true' } : {};
  }

  async create(dto: CreateMaintenancePlanDto, userId: string) {
    this.validateScope(dto.scope);
    if (dto.defaultAssigneeId)
      await this.usersService.getActiveUser(dto.defaultAssigneeId);
    const leadDays =
      dto.leadDays ??
      (await this.settingsService.get<number>(
        SettingKey.MAINTENANCE_LEAD_DAYS,
      ));
    const res = await super.create(
      {
        ...dto,
        code: await this.counterService.nextCode('KH', { period: 'YEAR' }),
        leadDays,
        nextRunDate: new Date(dto.startDate),
      },
      userId,
    );
    return this.findOne(String(res.data._id)).then((r) => ({
      ...r,
      statusCode: HttpStatus.CREATED,
      message: res.message,
    }));
  }

  async update(id: string, dto: UpdateMaintenancePlanDto, userId: string) {
    if (dto.scope) this.validateScope(dto.scope);
    if (dto.defaultAssigneeId)
      await this.usersService.getActiveUser(dto.defaultAssigneeId);
    const data: Record<string, any> = { ...dto };
    // Đổi ngày bắt đầu → tính lại đợt kế tiếp
    if (dto.startDate) data.nextRunDate = new Date(dto.startDate);
    return super.update(id, data, userId);
  }

  protected async beforeRemove(plan: MaintenancePlan) {
    // Huỷ các phiếu chưa thực hiện của kế hoạch
    await this.taskModel.updateMany(
      { planId: plan._id, status: { $in: OPEN_TASK_STATUSES } },
      { status: 'CANCELLED', skipReason: 'Kế hoạch bị xoá' },
    );
  }

  /** Danh sách tài sản thuộc phạm vi kế hoạch */
  async findScopeAssets(
    plan: MaintenancePlan,
    select = '_id assetCode name departmentId',
  ) {
    const disposed = await this.statusesService.getIdByCode(
      SystemAssetStatus.DISPOSED,
    );
    const {
      categoryIds = [],
      departmentIds = [],
      assetIds = [],
    } = plan.scope || ({} as any);
    const criteria: Record<string, any> = {};
    if (categoryIds.length) criteria.categoryId = { $in: categoryIds };
    if (departmentIds.length) criteria.departmentId = { $in: departmentIds };

    const or: Record<string, any>[] = [];
    if (Object.keys(criteria).length) or.push(criteria);
    if (assetIds.length) or.push({ _id: { $in: assetIds } });
    if (!or.length) return [];

    return this.assetModel
      .find({ isActive: true, statusId: { $ne: disposed }, $or: or })
      .select(select)
      .lean();
  }

  async previewAssets(id: string) {
    const plan = await this.findEntity(id);
    const assets = await this.findScopeAssets(
      plan,
      'assetCode name departmentId nextMaintenanceDate',
    );
    return createApiResponse(
      assets,
      `Kế hoạch áp dụng cho ${assets.length} tài sản`,
    );
  }

  private validateScope(scope: PlanScopeDto) {
    const empty =
      !scope?.categoryIds?.length &&
      !scope?.departmentIds?.length &&
      !scope?.assetIds?.length;
    if (empty) {
      throw new BadRequestException(
        'Vui lòng chọn phạm vi áp dụng (loại thiết bị, phòng ban hoặc tài sản cụ thể)',
      );
    }
  }

  /** Các kế hoạch đã đến lúc sinh phiếu (nextRunDate - leadDays <= hôm nay) */
  async findDuePlans(now = new Date()): Promise<MaintenancePlan[]> {
    const plans = await this.model.find({ isActive: true, isPaused: false });
    return plans.filter((p) => {
      if (p.endDate && p.nextRunDate > p.endDate) return false;
      const trigger = new Date(p.nextRunDate);
      trigger.setDate(trigger.getDate() - (p.leadDays ?? 0));
      return trigger <= now;
    });
  }

  toObjectIds(ids: any[]) {
    return ids.map((id) => new Types.ObjectId(String(id)));
  }
}

import {
  BadRequestException,
  ForbiddenException,
  HttpStatus,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { PERMISSIONS } from '../../common/constants/permissions.constant';
import {
  RefType,
  SystemAssetStatus,
} from '../../common/constants/system-codes';
import { CounterService } from '../../common/counters/counter.service';
import { AuthUser } from '../../common/interfaces/auth-user.interface';
import {
  addInterval,
  applyDateRange,
  paginate,
} from '../../common/utils/paginate.util';
import { hasPermission } from '../../common/utils/permission.util';
import { createApiResponse } from '../../common/utils/response.util';
import { AssetHistoryService } from '../assets/asset-history.service';
import { AssetHistoryAction } from '../assets/schemas/asset-history.schema';
import { AssetsService } from '../assets/assets.service';
import { AssetStatusesService } from '../catalogs/services/asset-statuses.service';
import { NotificationType } from '../notifications/schemas/notification.schema';
import { NotificationsService } from '../notifications/notifications.service';
import { SparePartsService } from '../spare-parts/spare-parts.service';
import { UsePartsDto } from '../spare-parts/dto/spare-part.dto';
import { UsersService } from '../users/users.service';
import {
  AssignTaskDto,
  CompleteTaskDto,
  CreateMaintenanceTaskDto,
  MaintenanceTaskQueryDto,
  SkipTaskDto,
} from './dto/maintenance.dto';
import {
  IntervalUnit,
  MaintenancePlan,
  MaintenanceTask,
  MaintenanceTaskStatus,
  MaintenanceType,
  OPEN_TASK_STATUSES,
} from './schemas/maintenance.schemas';

const TASK_POPULATE = [
  { path: 'planId', select: 'code name' },
  {
    path: 'assetId',
    select:
      'assetCode name serialNumber categoryId statusId departmentId locationId',
    populate: [
      { path: 'categoryId', select: 'code name' },
      { path: 'statusId', select: 'code name color' },
    ],
  },
  { path: 'assigneeId', select: 'employeeCode fullName email phone' },
  { path: 'completedBy', select: 'employeeCode fullName' },
];

@Injectable()
export class MaintenanceTasksService {
  constructor(
    @InjectModel(MaintenanceTask.name)
    private readonly taskModel: Model<MaintenanceTask>,
    @InjectModel(MaintenancePlan.name)
    private readonly planModel: Model<MaintenancePlan>,
    private readonly counterService: CounterService,
    private readonly assetsService: AssetsService,
    private readonly historyService: AssetHistoryService,
    private readonly statusesService: AssetStatusesService,
    private readonly sparePartsService: SparePartsService,
    private readonly usersService: UsersService,
    private readonly notificationsService: NotificationsService,
  ) {}

  /* =============================== Truy vấn =============================== */

  private scopeFilter(user: AuthUser): Record<string, any> {
    if (hasPermission(user, PERMISSIONS.MAINTENANCE_READ_ALL)) return {};
    const me = new Types.ObjectId(user.id);
    const or: Record<string, any>[] = [{ assigneeId: me }];
    if (
      hasPermission(user, PERMISSIONS.MAINTENANCE_READ_DEPARTMENT) &&
      user.departmentId
    ) {
      or.push({ departmentId: new Types.ObjectId(user.departmentId) });
    }
    return { $or: or };
  }

  async findAll(query: MaintenanceTaskQueryDto, user: AuthUser) {
    const filter: Record<string, any> = { isActive: true };
    if (query.status) {
      filter.status = { $in: query.status.split(',').map((s) => s.trim()) };
    }
    for (const key of [
      'planId',
      'assetId',
      'assigneeId',
      'departmentId',
    ] as const) {
      if (query[key]) filter[key] = new Types.ObjectId(query[key]);
    }
    if (query.assignee === 'me') {
      filter.assigneeId = new Types.ObjectId(user.id);
    }
    if (query.assignee === 'unassigned') filter.assigneeId = null;
    applyDateRange(filter, 'scheduledDate', query.fromDate, query.toDate);

    const scope = this.scopeFilter(user);
    const finalFilter: Record<string, any> = Object.keys(scope).length
      ? { $and: [filter, scope] }
      : filter;

    return paginate(this.taskModel, finalFilter, query, {
      populate: TASK_POPULATE,
      message: 'Lấy danh sách phiếu bảo trì thành công',
    });
  }

  async findOne(id: string, user: AuthUser) {
    const task = await this.taskModel
      .findOne({ _id: id, isActive: true })
      .populate(TASK_POPULATE)
      .lean();
    if (!task) throw new NotFoundException('Không tìm thấy phiếu bảo trì');
    if (!this.canView(task as any, user)) {
      throw new NotFoundException('Không tìm thấy phiếu bảo trì');
    }
    return createApiResponse(task, 'Lấy chi tiết phiếu bảo trì thành công');
  }

  private canView(task: any, user: AuthUser): boolean {
    if (hasPermission(user, PERMISSIONS.MAINTENANCE_READ_ALL)) return true;
    if (String(task.assigneeId?._id ?? task.assigneeId) === user.id)
      return true;
    if (
      hasPermission(user, PERMISSIONS.MAINTENANCE_READ_DEPARTMENT) &&
      user.departmentId &&
      String(task.departmentId) === user.departmentId
    ) {
      return true;
    }
    return false;
  }

  /** Lịch sử bảo trì / sửa chữa của 1 tài sản */
  async findAssetHistory(assetId: string) {
    const filter: Record<string, any> = { assetId, isActive: true };
    return paginate(this.taskModel, filter, { page: 1, limit: 50 } as any, {
      populate: TASK_POPULATE,
      defaultSort: { scheduledDate: -1 },
      message: 'Lấy lịch sử bảo trì / sửa chữa của tài sản thành công',
    });
  }

  /* =============================== Tạo & phân công =============================== */

  async create(dto: CreateMaintenanceTaskDto, user: AuthUser) {
    if (dto.assigneeId) await this.usersService.getActiveUser(dto.assigneeId);
    const assets = await Promise.all(
      dto.assetIds.map((id) => this.assetsService.getActiveAsset(id)),
    );
    const created: MaintenanceTask[] = [];
    for (const asset of assets) {
      const task = await this.taskModel.create({
        code: await this.counterService.nextCode('BT', { period: 'MONTH' }),
        type: MaintenanceType.AD_HOC,
        assetId: asset._id,
        departmentId: asset.departmentId,
        title: dto.title,
        scheduledDate: new Date(dto.scheduledDate),
        assigneeId: dto.assigneeId
          ? new Types.ObjectId(dto.assigneeId)
          : undefined,
        checklist: (dto.checklist || []).map((c) => ({
          item: c.item,
          required: c.required ?? true,
        })),
        status: MaintenanceTaskStatus.SCHEDULED,
        createdBy: user.id,
      });
      created.push(task);
      if (task.assigneeId) {
        await this.notificationsService.notifyUsers(
          [task.assigneeId],
          {
            type: NotificationType.MAINTENANCE_ASSIGNED,
            title: `Bạn được phân công phiếu bảo trì ${task.code}: ${task.title}`,
            content: `Tài sản ${asset.assetCode} - ${asset.name}`,
            refType: RefType.MAINTENANCE_TASK,
            refId: task._id,
          },
          user.id,
        );
      }
    }
    return createApiResponse(
      { created: created.length, tasks: created },
      `Đã tạo ${created.length} phiếu bảo trì`,
      HttpStatus.CREATED,
    );
  }

  async assign(id: string, dto: AssignTaskDto, user: AuthUser) {
    const task = await this.getTask(id);
    if (!OPEN_TASK_STATUSES.includes(task.status as any)) {
      throw new BadRequestException('Phiếu đã đóng, không thể phân công lại');
    }
    const assignee = await this.usersService.getActiveUser(dto.assigneeId);
    task.assigneeId = assignee._id as Types.ObjectId;
    task.status = MaintenanceTaskStatus.SCHEDULED;
    await task.save();
    await this.notificationsService.notifyUsers(
      [assignee._id],
      {
        type: NotificationType.MAINTENANCE_ASSIGNED,
        title: `Bạn được phân công phiếu bảo trì ${task.code}: ${task.title}`,
        refType: RefType.MAINTENANCE_TASK,
        refId: task._id,
      },
      user.id,
    );
    return this.findOne(id, user).then((r) => ({
      ...r,
      message: 'Phân công kỹ thuật viên thành công',
    }));
  }

  /* =============================== Bắt đầu / hoàn thành / bỏ qua =============================== */

  async start(id: string, user: AuthUser) {
    const task = await this.getTask(id);
    this.ensureAssignee(task, user);
    if (task.status === MaintenanceTaskStatus.COMPLETED) {
      throw new BadRequestException('Phiếu đã hoàn thành');
    }
    if (task.status === MaintenanceTaskStatus.IN_PROGRESS) {
      throw new BadRequestException('Phiếu đang được xử lý');
    }
    task.status = MaintenanceTaskStatus.IN_PROGRESS;
    task.startedAt = new Date();
    await task.save();

    if (task.assetId) {
      const asset = await this.assetsService.getActiveAsset(task.assetId);
      const res = await this.assetsService.moveToService(
        asset,
        SystemAssetStatus.UNDER_MAINTENANCE,
      );
      if (res.changed) {
        await this.historyService.log({
          assetId: asset._id,
          action: AssetHistoryAction.STATUS_CHANGED,
          description: `Đưa vào bảo trì theo phiếu ${task.code}`,
          fromStatusId: res.fromStatusId,
          toStatusId: res.toStatusId,
          refType: RefType.MAINTENANCE_TASK,
          refId: task._id,
          performedBy: user.id,
        });
      }
    }
    return this.findOne(id, user).then((r) => ({
      ...r,
      message: 'Đã bắt đầu bảo trì',
    }));
  }

  async complete(id: string, dto: CompleteTaskDto, user: AuthUser) {
    const task = await this.getTask(id);
    this.ensureAssignee(task, user);
    const now = new Date();
    task.checklistResults = (dto.checklistResults || []).map((c) => ({
      item: c.item,
      required: true,
      ok: c.ok,
      note: c.note,
    }));
    task.result = dto.result;
    task.conditionAfter = dto.conditionAfter;
    task.laborCost = dto.laborCost ?? 0;
    task.partsCost = (task.partsUsed || []).reduce(
      (s, p) => s + p.quantity * p.unitCost,
      0,
    );
    task.totalCost = task.partsCost + task.laborCost;
    task.status = MaintenanceTaskStatus.COMPLETED;
    task.completedAt = now;
    task.completedBy = new Types.ObjectId(user.id);
    task.images = dto.images || [];
    await task.save();

    if (task.assetId) {
      const asset = await this.assetsService.getActiveAsset(task.assetId);
      let fromStatusId = asset.statusId;
      let toStatusId = asset.statusId;
      if (dto.assetStatusId) {
        const status = await this.statusesService.findEntity(dto.assetStatusId);
        if (status.isFinal) {
          throw new BadRequestException(
            'Thanh lý phải thực hiện qua yêu cầu thanh lý',
          );
        }
        fromStatusId = asset.statusId;
        asset.statusId = status._id as Types.ObjectId;
        asset.statusBeforeService = undefined;
        await asset.save();
        toStatusId = asset.statusId;
      } else {
        ({ fromStatusId, toStatusId } =
          await this.assetsService.restoreFromService(asset));
      }
      // Cập nhật chu kỳ bảo trì
      if (asset.maintenanceCycleMonths) {
        asset.lastMaintenanceDate = now;
        asset.nextMaintenanceDate = addInterval(
          now,
          asset.maintenanceCycleMonths,
          IntervalUnit.MONTH,
        );
        await asset.save();
      }
      await this.historyService.log({
        assetId: asset._id,
        action: AssetHistoryAction.MAINTAINED,
        description: `Hoàn thành bảo trì theo phiếu ${task.code}: ${task.result}`,
        fromStatusId,
        toStatusId,
        cost: task.totalCost,
        refType: RefType.MAINTENANCE_TASK,
        refId: task._id,
        performedBy: user.id,
      });
    }

    // Tính lần chạy kế tiếp cho kế hoạch (nếu có)
    if (task.planId) {
      const plan = await this.planModel.findById(task.planId);
      if (plan && !plan.isPaused) {
        const next = addInterval(
          plan.nextRunDate,
          plan.intervalValue,
          plan.intervalUnit as IntervalUnit,
        );
        plan.nextRunDate = next;
        plan.lastRunAt = now;
        plan.runCount = (plan.runCount || 0) + 1;
        await plan.save();
      }
    }

    return this.findOne(id, user).then((r) => ({
      ...r,
      message: 'Hoàn thành bảo trì',
    }));
  }

  async skip(id: string, dto: SkipTaskDto, user: AuthUser) {
    const task = await this.getTask(id);
    if (!OPEN_TASK_STATUSES.includes(task.status as any)) {
      throw new BadRequestException('Phiếu đã đóng, không thể bỏ qua');
    }
    task.status = MaintenanceTaskStatus.SKIPPED;
    task.skipReason = dto.reason;
    await task.save();

    if (task.assetId) {
      const asset = await this.assetsService.getActiveAsset(task.assetId);
      const res = await this.assetsService.restoreFromService(asset);
      if (res.changed) {
        await this.historyService.log({
          assetId: asset._id,
          action: AssetHistoryAction.STATUS_CHANGED,
          description: `Bỏ qua phiếu bảo trì ${task.code}: ${dto.reason}`,
          fromStatusId: res.fromStatusId,
          toStatusId: res.toStatusId,
          refType: RefType.MAINTENANCE_TASK,
          refId: task._id,
          performedBy: user.id,
        });
      }
    }
    return this.findOne(id, user).then((r) => ({
      ...r,
      message: 'Đã bỏ qua phiếu bảo trì',
    }));
  }

  /** Cập nhật vật tư tiêu hao cho phiếu bảo trì (dùng chung với ticket) */
  async useParts(id: string, dto: UsePartsDto, user: AuthUser) {
    const task = await this.getTask(id);
    this.ensureAssignee(task, user);
    const used = await this.sparePartsService.consume(dto.items, {
      refType: RefType.MAINTENANCE_TASK,
      refId: task._id,
      assetId: task.assetId,
      performedBy: user.id,
      note: dto.note || `Xuất cho phiếu bảo trì ${task.code}`,
    });
    task.partsUsed.push(...used);
    task.partsCost = (task.partsUsed || []).reduce(
      (s, p) => s + p.quantity * p.unitCost,
      0,
    );
    task.totalCost = task.partsCost + task.laborCost;
    await task.save();
    return this.findOne(id, user).then((r) => ({
      ...r,
      message: 'Đã cập nhật vật tư tiêu hao',
    }));
  }

  async remove(id: string, userId: string) {
    const task = await this.getTask(id);
    if (
      !hasPermission(
        { permissions: [] } as AuthUser,
        PERMISSIONS.MAINTENANCE_PLAN,
      ) &&
      task.status !== MaintenanceTaskStatus.SCHEDULED
    ) {
      throw new BadRequestException('Chỉ có thể xoá phiếu chưa thực hiện');
    }
    task.isActive = false;
    task.updatedBy = userId as any;
    await task.save();
    return createApiResponse(null, 'Xoá phiếu bảo trì thành công');
  }

  /* =============================== Helpers =============================== */

  private async getTask(id: string) {
    const task = await this.taskModel.findOne({ _id: id, isActive: true });
    if (!task) throw new NotFoundException('Không tìm thấy phiếu bảo trì');
    return task;
  }

  private ensureAssignee(task: MaintenanceTask, user: AuthUser) {
    const isAssignee = String(task.assigneeId) === user.id;
    if (!isAssignee && !hasPermission(user, PERMISSIONS.MAINTENANCE_PLAN)) {
      throw new ForbiddenException(
        'Chỉ kỹ thuật viên được phân công hoặc quản lý tài sản mới thực hiện được',
      );
    }
  }
}

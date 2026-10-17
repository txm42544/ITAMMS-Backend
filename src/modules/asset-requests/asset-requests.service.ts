import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  HttpStatus,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import {
  ALL_PERMISSIONS,
  PERMISSIONS,
} from '../../common/constants/permissions.constant';
import {
  RefType,
  SystemAssetStatus,
} from '../../common/constants/system-codes';
import { CounterService } from '../../common/counters/counter.service';
import { AuthUser } from '../../common/interfaces/auth-user.interface';
import { combineFilters } from '../../common/utils/data-scope.util';
import { paginate } from '../../common/utils/paginate.util';
import { hasPermission } from '../../common/utils/permission.util';
import { buildSearchFilter } from '../../common/utils/regex.util';
import { createApiResponse } from '../../common/utils/response.util';
import { AssetHistoryService } from '../assets/asset-history.service';
import { AssetHistoryAction } from '../assets/schemas/asset-history.schema';
import { Asset } from '../assets/schemas/asset.schema';
import { AssetStatusesService } from '../catalogs/services/asset-statuses.service';
import { LocationsService } from '../catalogs/services/locations.service';
import { DepartmentsService } from '../departments/departments.service';
import { NotificationType } from '../notifications/schemas/notification.schema';
import { NotificationsService } from '../notifications/notifications.service';
import { UsersService } from '../users/users.service';
import {
  AssetRequestQueryDto,
  CreateAssetRequestDto,
  DecisionDto,
  ExecuteAssetRequestDto,
  RejectDto,
} from './dto/asset-request.dto';
import {
  ApprovalDecision,
  ApprovalStep,
  ApprovalType,
  AssetRequest,
  AssetRequestStatus,
  AssetRequestType,
} from './schemas/asset-request.schema';

export const REQUEST_TYPE_LABEL: Record<AssetRequestType, string> = {
  [AssetRequestType.ALLOCATION]: 'Cấp phát',
  [AssetRequestType.HANDOVER]: 'Bàn giao',
  [AssetRequestType.RETURN]: 'Thu hồi',
  [AssetRequestType.TRANSFER]: 'Điều chuyển',
  [AssetRequestType.DISPOSAL]: 'Thanh lý',
};

const OPEN_STATUSES = [AssetRequestStatus.PENDING, AssetRequestStatus.APPROVED];

const REQUEST_POPULATE = [
  {
    path: 'assetIds',
    select: 'assetCode name serialNumber statusId departmentId currentUserId',
    populate: [
      { path: 'statusId', select: 'code name color' },
      { path: 'currentUserId', select: 'employeeCode fullName' },
    ],
  },
  { path: 'requestedBy', select: 'employeeCode fullName' },
  { path: 'fromDepartmentId', select: 'code name' },
  { path: 'toDepartmentId', select: 'code name' },
  { path: 'fromUserId', select: 'employeeCode fullName' },
  { path: 'toUserId', select: 'employeeCode fullName' },
  { path: 'toLocationId', select: 'code name' },
  { path: 'approvals.approverId', select: 'employeeCode fullName' },
  { path: 'approvals.departmentId', select: 'code name' },
  { path: 'executedBy', select: 'employeeCode fullName' },
];

type PopulatedAsset = Asset & { statusId: any };

@Injectable()
export class AssetRequestsService {
  constructor(
    @InjectModel(AssetRequest.name)
    private readonly requestModel: Model<AssetRequest>,
    @InjectModel(Asset.name) private readonly assetModel: Model<Asset>,
    private readonly counterService: CounterService,
    private readonly historyService: AssetHistoryService,
    private readonly statusesService: AssetStatusesService,
    private readonly locationsService: LocationsService,
    private readonly departmentsService: DepartmentsService,
    private readonly usersService: UsersService,
    private readonly notificationsService: NotificationsService,
  ) {}

  /* =============================== Truy vấn =============================== */

  private scopeFilter(user: AuthUser): Record<string, any> {
    if (hasPermission(user, PERMISSIONS.ASSET_REQUEST_READ_ALL)) return {};
    const me = new Types.ObjectId(user.id);
    const or: Record<string, any>[] = [
      { requestedBy: me },
      { fromUserId: me },
      { toUserId: me },
    ];
    if (
      hasPermission(user, PERMISSIONS.ASSET_REQUEST_APPROVE_DEPARTMENT) &&
      user.departmentId
    ) {
      const dept = new Types.ObjectId(user.departmentId);
      or.push({ fromDepartmentId: dept }, { toDepartmentId: dept });
    }
    if (hasPermission(user, PERMISSIONS.ASSET_REQUEST_APPROVE_DISPOSAL)) {
      or.push({ type: AssetRequestType.DISPOSAL });
    }
    return { $or: or };
  }

  private pendingMyApprovalFilter(user: AuthUser): Record<string, any> {
    if (user.permissions.includes(ALL_PERMISSIONS)) {
      return { status: AssetRequestStatus.PENDING };
    }
    const or: Record<string, any>[] = [];
    if (
      hasPermission(user, PERMISSIONS.ASSET_REQUEST_APPROVE_DEPARTMENT) &&
      user.departmentId
    ) {
      or.push({
        'pendingApproval.type': ApprovalType.DEPARTMENT,
        'pendingApproval.departmentId': new Types.ObjectId(user.departmentId),
      });
    }
    if (hasPermission(user, PERMISSIONS.ASSET_REQUEST_APPROVE_DISPOSAL)) {
      or.push({ 'pendingApproval.type': ApprovalType.DISPOSAL });
    }
    if (!or.length) return { _id: null };
    return { status: AssetRequestStatus.PENDING, $or: or };
  }

  async findAll(query: AssetRequestQueryDto, user: AuthUser) {
    const filter: Record<string, any> = { isActive: true };
    if (query.type) filter.type = query.type;
    if (query.status) filter.status = query.status;
    if (query.assetId) filter.assetIds = new Types.ObjectId(query.assetId);
    const deptFilter = query.departmentId
      ? {
          $or: [
            { fromDepartmentId: new Types.ObjectId(query.departmentId) },
            { toDepartmentId: new Types.ObjectId(query.departmentId) },
          ],
        }
      : {};
    const finalFilter = combineFilters(
      filter,
      deptFilter,
      buildSearchFilter(query.search, ['code', 'reason']),
      query.pendingMyApproval === 'true'
        ? this.pendingMyApprovalFilter(user)
        : this.scopeFilter(user),
    );
    return paginate(this.requestModel, finalFilter, query, {
      populate: REQUEST_POPULATE,
      message: 'Lấy danh sách yêu cầu thành công',
    });
  }

  async findOne(id: string, user: AuthUser) {
    const request = await this.requestModel
      .findOne(
        combineFilters({ _id: id, isActive: true }, this.scopeFilter(user)),
      )
      .populate(REQUEST_POPULATE)
      .lean();
    if (!request) throw new NotFoundException('Không tìm thấy yêu cầu');
    return createApiResponse(request, 'Lấy chi tiết yêu cầu thành công');
  }

  /* =============================== Tạo yêu cầu =============================== */

  async create(dto: CreateAssetRequestDto, user: AuthUser) {
    const assetIds = [...new Set(dto.assetIds)];
    const assets = (await this.assetModel
      .find({ _id: { $in: assetIds }, isActive: true })
      .populate(
        'statusId',
        'code name isFinal allowAssign',
      )) as PopulatedAsset[];
    if (assets.length !== assetIds.length) {
      throw new NotFoundException('Có tài sản không tồn tại hoặc đã bị xoá');
    }
    for (const a of assets) {
      if (a.statusId?.isFinal) {
        throw new BadRequestException(`Tài sản ${a.assetCode} đã thanh lý`);
      }
    }
    const busy = await this.requestModel
      .findOne({ assetIds: { $in: assetIds }, status: { $in: OPEN_STATUSES } })
      .select('code');
    if (busy) {
      throw new ConflictException(
        `Có tài sản đang nằm trong yêu cầu ${busy.code} chưa hoàn tất`,
      );
    }
    if (dto.toLocationId)
      await this.locationsService.findEntity(dto.toLocationId);

    const plan = await this.buildPlan(dto, assets);
    const approvals: ApprovalStep[] = plan.approvals.map((a, idx) => ({
      step: idx + 1,
      decision: ApprovalDecision.PENDING,
      ...a,
    }));

    const request = await this.requestModel.create({
      code: await this.counterService.nextCode('YC', { period: 'MONTH' }),
      type: dto.type,
      assetIds,
      requestedBy: user.id,
      fromDepartmentId: plan.fromDepartmentId,
      toDepartmentId: dto.toDepartmentId,
      fromUserId: plan.fromUserId,
      toUserId: dto.toUserId,
      toLocationId: dto.toLocationId,
      reason: dto.reason,
      expectedDate: dto.expectedDate,
      disposalMethod: dto.disposalMethod,
      attachments: dto.attachments ?? [],
      approvals,
      pendingApproval: approvals[0]
        ? {
            step: 1,
            type: approvals[0].type,
            departmentId: approvals[0].departmentId,
          }
        : null,
      status: approvals.length
        ? AssetRequestStatus.PENDING
        : AssetRequestStatus.APPROVED,
      createdBy: user.id,
    });

    if (approvals[0])
      await this.notifyApprovers(request, approvals[0], user.id);
    else await this.notifyExecutors(request, user.id);

    return this.findOne(String(request._id), user).then((r) => ({
      ...r,
      statusCode: HttpStatus.CREATED,
      message: `Tạo yêu cầu ${REQUEST_TYPE_LABEL[dto.type].toLowerCase()} thành công`,
    }));
  }

  /** Kiểm tra nghiệp vụ theo loại yêu cầu và xác định các bước duyệt */
  private async buildPlan(
    dto: CreateAssetRequestDto,
    assets: PopulatedAsset[],
  ) {
    const approvals: Pick<ApprovalStep, 'type' | 'departmentId'>[] = [];
    let fromDepartmentId: Types.ObjectId | undefined;
    let fromUserId: Types.ObjectId | undefined;

    const toUser = dto.toUserId
      ? await this.usersService.getActiveUser(dto.toUserId)
      : null;
    if (dto.toDepartmentId)
      await this.departmentsService.findEntity(dto.toDepartmentId);

    const commonHolder = () => {
      const holders = new Set(assets.map((a) => String(a.currentUserId ?? '')));
      return holders.size === 1 && assets[0].currentUserId
        ? assets[0].currentUserId
        : undefined;
    };

    switch (dto.type) {
      case AssetRequestType.ALLOCATION: {
        if (!dto.toDepartmentId) {
          throw new BadRequestException('Vui lòng chọn phòng ban nhận');
        }
        for (const a of assets) {
          if (a.currentUserId || !a.statusId?.allowAssign) {
            throw new BadRequestException(
              `Tài sản ${a.assetCode} không ở trạng thái sẵn sàng cấp phát`,
            );
          }
        }
        if (toUser && String(toUser.departmentId) !== dto.toDepartmentId) {
          throw new BadRequestException(
            'Người nhận không thuộc phòng ban nhận',
          );
        }
        approvals.push({
          type: ApprovalType.DEPARTMENT,
          departmentId: new Types.ObjectId(dto.toDepartmentId),
        });
        break;
      }

      case AssetRequestType.HANDOVER: {
        if (!toUser)
          throw new BadRequestException('Vui lòng chọn người nhận bàn giao');
        fromDepartmentId = this.commonDepartment(assets, true);
        if (String(toUser.departmentId) !== String(fromDepartmentId)) {
          throw new BadRequestException(
            'Người nhận thuộc phòng ban khác — hãy tạo yêu cầu điều chuyển',
          );
        }
        if (assets.some((a) => String(a.currentUserId) === dto.toUserId)) {
          throw new BadRequestException('Người nhận đang sử dụng tài sản này');
        }
        fromUserId = commonHolder();
        approvals.push({
          type: ApprovalType.DEPARTMENT,
          departmentId: fromDepartmentId,
        });
        break;
      }

      case AssetRequestType.RETURN: {
        for (const a of assets) {
          if (!a.currentUserId && !a.departmentId) {
            throw new BadRequestException(
              `Tài sản ${a.assetCode} đang ở trong kho`,
            );
          }
        }
        fromDepartmentId = this.commonDepartment(assets, false);
        fromUserId = commonHolder();
        if (fromDepartmentId) {
          approvals.push({
            type: ApprovalType.DEPARTMENT,
            departmentId: fromDepartmentId,
          });
        }
        break;
      }

      case AssetRequestType.TRANSFER: {
        if (!dto.toDepartmentId) {
          throw new BadRequestException('Vui lòng chọn phòng ban nhận');
        }
        fromDepartmentId = this.commonDepartment(assets, true);
        if (String(fromDepartmentId) === dto.toDepartmentId) {
          throw new BadRequestException(
            'Phòng ban nhận phải khác phòng ban hiện tại',
          );
        }
        if (toUser && String(toUser.departmentId) !== dto.toDepartmentId) {
          throw new BadRequestException(
            'Người nhận không thuộc phòng ban nhận',
          );
        }
        fromUserId = commonHolder();
        approvals.push(
          { type: ApprovalType.DEPARTMENT, departmentId: fromDepartmentId },
          {
            type: ApprovalType.DEPARTMENT,
            departmentId: new Types.ObjectId(dto.toDepartmentId),
          },
        );
        break;
      }

      case AssetRequestType.DISPOSAL: {
        for (const a of assets) {
          if (a.currentUserId) {
            throw new BadRequestException(
              `Tài sản ${a.assetCode} đang có người sử dụng, cần thu hồi trước khi thanh lý`,
            );
          }
        }
        fromDepartmentId = this.commonDepartment(assets, false, false);
        approvals.push({ type: ApprovalType.DISPOSAL });
        break;
      }
    }
    return { approvals, fromDepartmentId, fromUserId };
  }

  /** Phòng ban chung của các tài sản (ném lỗi nếu khác nhau) */
  private commonDepartment(
    assets: Asset[],
    required: boolean,
    strict = true,
  ): Types.ObjectId | undefined {
    const ids = new Set(assets.map((a) => String(a.departmentId ?? '')));
    if (ids.size > 1) {
      if (!strict) return undefined;
      throw new BadRequestException(
        'Các tài sản phải thuộc cùng một phòng ban',
      );
    }
    const dept = assets[0].departmentId;
    if (required && !dept) {
      throw new BadRequestException(
        `Tài sản ${assets[0].assetCode} chưa thuộc phòng ban nào`,
      );
    }
    return dept;
  }

  /* =============================== Phê duyệt =============================== */

  private canApprove(user: AuthUser, step: ApprovalStep): boolean {
    if (user.permissions.includes(ALL_PERMISSIONS)) return true;
    if (step.type === ApprovalType.DISPOSAL) {
      return hasPermission(user, PERMISSIONS.ASSET_REQUEST_APPROVE_DISPOSAL);
    }
    return (
      hasPermission(user, PERMISSIONS.ASSET_REQUEST_APPROVE_DEPARTMENT) &&
      !!user.departmentId &&
      user.departmentId === String(step.departmentId)
    );
  }

  private async getRequest(id: string) {
    const request = await this.requestModel.findOne({
      _id: id,
      isActive: true,
    });
    if (!request) throw new NotFoundException('Không tìm thấy yêu cầu');
    return request;
  }

  async approve(id: string, dto: DecisionDto, user: AuthUser) {
    const request = await this.getRequest(id);
    if (request.status !== AssetRequestStatus.PENDING) {
      throw new BadRequestException('Yêu cầu không ở trạng thái chờ duyệt');
    }
    const step = request.approvals.find(
      (s) => s.decision === ApprovalDecision.PENDING,
    );
    if (!step || !this.canApprove(user, step)) {
      throw new ForbiddenException('Bạn không có quyền duyệt bước này');
    }
    Object.assign(step, {
      decision: ApprovalDecision.APPROVED,
      approverId: new Types.ObjectId(user.id),
      note: dto.note,
      decidedAt: new Date(),
    });

    const next = request.approvals.find(
      (s) => s.decision === ApprovalDecision.PENDING,
    );
    if (next) {
      request.pendingApproval = {
        step: next.step,
        type: next.type,
        departmentId: next.departmentId,
      };
    } else {
      request.pendingApproval = null;
      request.status = AssetRequestStatus.APPROVED;
    }
    request.updatedBy = user.id as any;
    await request.save();

    const label = REQUEST_TYPE_LABEL[request.type];
    if (next) {
      await this.notifyApprovers(request, next, user.id);
    } else {
      await this.notificationsService.notifyUsers(
        [request.requestedBy],
        {
          type: NotificationType.ASSET_REQUEST_DECIDED,
          title: `Yêu cầu ${label.toLowerCase()} ${request.code} đã được duyệt`,
          content: dto.note,
          refType: RefType.ASSET_REQUEST,
          refId: request._id,
        },
        user.id,
      );
      await this.notifyExecutors(request, user.id);
    }
    return this.findOne(id, user).then((r) => ({
      ...r,
      message: 'Phê duyệt thành công',
    }));
  }

  async reject(id: string, dto: RejectDto, user: AuthUser) {
    const request = await this.getRequest(id);
    if (request.status !== AssetRequestStatus.PENDING) {
      throw new BadRequestException('Yêu cầu không ở trạng thái chờ duyệt');
    }
    const step = request.approvals.find(
      (s) => s.decision === ApprovalDecision.PENDING,
    );
    if (!step || !this.canApprove(user, step)) {
      throw new ForbiddenException('Bạn không có quyền duyệt bước này');
    }
    Object.assign(step, {
      decision: ApprovalDecision.REJECTED,
      approverId: new Types.ObjectId(user.id),
      note: dto.note,
      decidedAt: new Date(),
    });
    request.status = AssetRequestStatus.REJECTED;
    request.pendingApproval = null;
    request.updatedBy = user.id as any;
    await request.save();

    await this.notificationsService.notifyUsers(
      [request.requestedBy],
      {
        type: NotificationType.ASSET_REQUEST_DECIDED,
        title: `Yêu cầu ${REQUEST_TYPE_LABEL[request.type].toLowerCase()} ${request.code} bị từ chối`,
        content: dto.note,
        refType: RefType.ASSET_REQUEST,
        refId: request._id,
      },
      user.id,
    );
    return this.findOne(id, user).then((r) => ({
      ...r,
      message: 'Đã từ chối yêu cầu',
    }));
  }

  async cancel(id: string, user: AuthUser) {
    const request = await this.getRequest(id);
    if (!OPEN_STATUSES.includes(request.status)) {
      throw new BadRequestException(
        'Chỉ huỷ được yêu cầu đang chờ duyệt hoặc chờ thực hiện',
      );
    }
    const isOwner = String(request.requestedBy) === user.id;
    if (!isOwner && !hasPermission(user, PERMISSIONS.ASSET_REQUEST_EXECUTE)) {
      throw new ForbiddenException('Bạn không có quyền huỷ yêu cầu này');
    }
    request.status = AssetRequestStatus.CANCELLED;
    request.pendingApproval = null;
    request.cancelledBy = new Types.ObjectId(user.id);
    await request.save();
    return createApiResponse(
      { _id: request._id, status: request.status },
      'Đã huỷ yêu cầu',
    );
  }

  /* =============================== Thực hiện =============================== */

  async execute(id: string, dto: ExecuteAssetRequestDto, user: AuthUser) {
    const request = await this.getRequest(id);
    if (request.status !== AssetRequestStatus.APPROVED) {
      throw new BadRequestException('Yêu cầu chưa được duyệt hoặc đã xử lý');
    }
    const assets = (await this.assetModel
      .find({ _id: { $in: request.assetIds }, isActive: true })
      .populate('statusId', 'code isFinal allowAssign')) as PopulatedAsset[];
    if (assets.length !== request.assetIds.length) {
      throw new BadRequestException('Có tài sản trong yêu cầu đã bị xoá');
    }

    const [inStock, inUse, disposed] = await Promise.all([
      this.statusesService.getIdByCode(SystemAssetStatus.IN_STOCK),
      this.statusesService.getIdByCode(SystemAssetStatus.IN_USE),
      this.statusesService.getIdByCode(SystemAssetStatus.DISPOSED),
    ]);
    const now = new Date();
    const histories = [];

    for (const asset of assets) {
      const status = asset.statusId;
      if (status?.isFinal) {
        throw new BadRequestException(`Tài sản ${asset.assetCode} đã thanh lý`);
      }
      const from = {
        fromUserId: asset.currentUserId,
        fromDepartmentId: asset.departmentId,
        fromLocationId: asset.locationId,
        fromStatusId: status?._id,
      };
      let action: AssetHistoryAction;

      switch (request.type) {
        case AssetRequestType.ALLOCATION:
          if (asset.currentUserId || !status?.allowAssign) {
            throw new BadRequestException(
              `Tài sản ${asset.assetCode} không còn sẵn sàng cấp phát`,
            );
          }
          asset.departmentId = request.toDepartmentId;
          asset.currentUserId = request.toUserId;
          asset.assignedAt = request.toUserId ? now : undefined;
          if (request.toLocationId) asset.locationId = request.toLocationId;
          asset.statusId = inUse;
          action = AssetHistoryAction.ASSIGNED;
          break;

        case AssetRequestType.HANDOVER:
          asset.currentUserId = request.toUserId;
          asset.assignedAt = now;
          if (request.toLocationId) asset.locationId = request.toLocationId;
          if (String(status?._id) === String(inStock)) asset.statusId = inUse;
          action = AssetHistoryAction.HANDED_OVER;
          break;

        case AssetRequestType.RETURN:
          asset.currentUserId = undefined;
          asset.departmentId = undefined;
          asset.assignedAt = undefined;
          asset.locationId = request.toLocationId;
          if (String(status?._id) === String(inUse)) asset.statusId = inStock;
          action = AssetHistoryAction.RETURNED;
          break;

        case AssetRequestType.TRANSFER:
          asset.departmentId = request.toDepartmentId;
          asset.currentUserId = request.toUserId;
          asset.assignedAt = request.toUserId ? now : undefined;
          asset.locationId = request.toLocationId;
          action = AssetHistoryAction.TRANSFERRED;
          break;

        case AssetRequestType.DISPOSAL:
          asset.statusId = disposed;
          asset.currentUserId = undefined;
          asset.departmentId = undefined;
          asset.nextMaintenanceDate = undefined;
          asset.disposedAt = now;
          asset.disposalInfo = {
            method: dto.disposalMethod || request.disposalMethod,
            recoveredValue: dto.recoveredValue
              ? Math.round(dto.recoveredValue / assets.length)
              : 0,
            note: dto.note,
            requestId: request._id as Types.ObjectId,
          };
          action = AssetHistoryAction.DISPOSED;
          break;
      }

      asset.updatedBy = user.id as any;
      await asset.save();
      histories.push({
        assetId: asset._id,
        action,
        description: `${REQUEST_TYPE_LABEL[request.type]} theo yêu cầu ${request.code}`,
        ...from,
        toUserId: asset.currentUserId,
        toDepartmentId: asset.departmentId,
        toLocationId: asset.locationId,
        toStatusId: asset.statusId,
        refType: RefType.ASSET_REQUEST,
        refId: request._id,
        performedBy: user.id,
      });
    }
    await this.historyService.logMany(histories);

    request.status = AssetRequestStatus.COMPLETED;
    request.executedBy = new Types.ObjectId(user.id);
    request.executedAt = now;
    request.executionNote = dto.note;
    if (dto.disposalMethod) request.disposalMethod = dto.disposalMethod;
    if (dto.recoveredValue !== undefined)
      request.recoveredValue = dto.recoveredValue;
    if (dto.attachments?.length) {
      request.attachments = [...request.attachments, ...dto.attachments];
    }
    await request.save();

    await this.notificationsService.notifyUsers(
      [request.requestedBy, request.toUserId, request.fromUserId],
      {
        type: NotificationType.ASSET_REQUEST_COMPLETED,
        title: `Đã thực hiện ${REQUEST_TYPE_LABEL[request.type].toLowerCase()} ${request.code}`,
        content: `${assets.length} tài sản: ${assets.map((a) => a.assetCode).join(', ')}`,
        refType: RefType.ASSET_REQUEST,
        refId: request._id,
      },
      user.id,
    );
    return this.findOne(id, user).then((r) => ({
      ...r,
      message: 'Thực hiện yêu cầu thành công',
    }));
  }

  /* =============================== Thông báo =============================== */

  private async notifyApprovers(
    request: AssetRequest,
    step: ApprovalStep,
    actorId: string,
  ) {
    const payload = {
      type: NotificationType.ASSET_REQUEST_PENDING,
      title: `Yêu cầu ${REQUEST_TYPE_LABEL[request.type].toLowerCase()} ${request.code} chờ bạn duyệt`,
      content: request.reason,
      refType: RefType.ASSET_REQUEST,
      refId: request._id,
    };
    if (step.type === ApprovalType.DISPOSAL) {
      await this.notificationsService.notifyPermission(
        PERMISSIONS.ASSET_REQUEST_APPROVE_DISPOSAL,
        payload,
        { excludeUserId: actorId },
      );
      return;
    }
    const dept = await this.departmentsService.findEntity(
      String(step.departmentId),
    );
    const approverIds = await this.usersService.findIdsByPermission(
      PERMISSIONS.ASSET_REQUEST_APPROVE_DEPARTMENT,
      { departmentId: step.departmentId },
    );
    await this.notificationsService.notifyUsers(
      [dept.managerId, ...approverIds],
      payload,
      actorId,
    );
  }

  private async notifyExecutors(request: AssetRequest, actorId: string) {
    await this.notificationsService.notifyPermission(
      PERMISSIONS.ASSET_REQUEST_EXECUTE,
      {
        type: NotificationType.ASSET_REQUEST_DECIDED,
        title: `Yêu cầu ${request.code} đã được duyệt, chờ thực hiện`,
        content: request.reason,
        refType: RefType.ASSET_REQUEST,
        refId: request._id,
      },
      { excludeUserId: actorId },
    );
  }
}

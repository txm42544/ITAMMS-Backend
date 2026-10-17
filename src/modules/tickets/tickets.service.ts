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
  SettingKey,
  SystemAssetStatus,
} from '../../common/constants/system-codes';
import { CounterService } from '../../common/counters/counter.service';
import { AuthUser } from '../../common/interfaces/auth-user.interface';
import { combineFilters } from '../../common/utils/data-scope.util';
import {
  addDays,
  applyDateRange,
  paginate,
} from '../../common/utils/paginate.util';
import { hasPermission } from '../../common/utils/permission.util';
import { buildSearchFilter } from '../../common/utils/regex.util';
import { createApiResponse } from '../../common/utils/response.util';
import { AssetHistoryService } from '../assets/asset-history.service';
import { AssetsService } from '../assets/assets.service';
import { AssetHistoryAction } from '../assets/schemas/asset-history.schema';
import { AssetStatusesService } from '../catalogs/services/asset-statuses.service';
import { IncidentTypesService } from '../catalogs/services/incident-types.service';
import { SettingsService } from '../catalogs/services/settings.service';
import { NotificationType } from '../notifications/schemas/notification.schema';
import {
  NotificationsService,
  NotifyPayload,
} from '../notifications/notifications.service';
import { UsePartsDto } from '../spare-parts/dto/spare-part.dto';
import { SparePartsService } from '../spare-parts/spare-parts.service';
import { UsersService } from '../users/users.service';
import {
  AcceptTicketDto,
  AssignTicketDto,
  CreateRepairRequestDto,
  CreateTicketDto,
  DiagnosisDto,
  OptionalNoteDto,
  ReceiveTicketDto,
  ResolveTicketDto,
  TicketNoteDto,
  TicketQueryDto,
} from './dto/ticket.dto';
import { RepairRequestsService } from './repair-requests.service';
import {
  OPEN_TICKET_STATUSES,
  Ticket,
  TicketSource,
  TicketStatus,
} from './schemas/ticket.schema';
import { assertTransition, TICKET_STATUS_LABEL } from './ticket-workflow';

export const TICKET_POPULATE = [
  {
    path: 'assetId',
    select:
      'assetCode name serialNumber brand deviceModel categoryId statusId locationId departmentId currentUserId warrantyEndDate',
    populate: [
      { path: 'categoryId', select: 'code name' },
      { path: 'statusId', select: 'code name color' },
      { path: 'locationId', select: 'code name' },
    ],
  },
  { path: 'reportedBy', select: 'employeeCode fullName email phone' },
  { path: 'departmentId', select: 'code name' },
  { path: 'incidentTypeId', select: 'code name slaHours' },
  { path: 'assigneeId', select: 'employeeCode fullName email phone' },
  { path: 'receivedBy', select: 'employeeCode fullName' },
  { path: 'timeline.by', select: 'employeeCode fullName' },
];

@Injectable()
export class TicketsService {
  constructor(
    @InjectModel(Ticket.name) private readonly ticketModel: Model<Ticket>,
    private readonly counterService: CounterService,
    private readonly assetsService: AssetsService,
    private readonly historyService: AssetHistoryService,
    private readonly statusesService: AssetStatusesService,
    private readonly incidentTypesService: IncidentTypesService,
    private readonly settingsService: SettingsService,
    private readonly sparePartsService: SparePartsService,
    private readonly usersService: UsersService,
    private readonly notificationsService: NotificationsService,
    private readonly repairRequestsService: RepairRequestsService,
  ) {}

  /* =============================== Truy vấn =============================== */

  private scopeFilter(user: AuthUser): Record<string, any> {
    if (hasPermission(user, PERMISSIONS.TICKET_READ_ALL)) return {};
    const me = new Types.ObjectId(user.id);
    const or: Record<string, any>[] = [{ reportedBy: me }, { assigneeId: me }];
    if (
      hasPermission(user, PERMISSIONS.TICKET_READ_DEPARTMENT) &&
      user.departmentId
    ) {
      or.push({ departmentId: new Types.ObjectId(user.departmentId) });
    }
    return { $or: or };
  }

  async findAll(query: TicketQueryDto, user: AuthUser, onlyMine = false) {
    const filter: Record<string, any> = { isActive: true };
    if (query.status)
      filter.status = { $in: query.status.split(',').map((s) => s.trim()) };
    if (query.priority) filter.priority = query.priority;
    for (const key of [
      'assigneeId',
      'assetId',
      'departmentId',
      'incidentTypeId',
      'reportedBy',
    ] as const) {
      if (query[key]) filter[key] = new Types.ObjectId(query[key]);
    }
    if (query.assignee === 'me')
      filter.assigneeId = new Types.ObjectId(user.id);
    if (query.assignee === 'unassigned') filter.assigneeId = null;
    if (query.overdue === 'true') {
      filter.dueAt = { $lt: new Date() };
      filter.status = { $in: OPEN_TICKET_STATUSES };
    }
    if (onlyMine) filter.reportedBy = new Types.ObjectId(user.id);
    applyDateRange(filter, 'createdAt', query.fromDate, query.toDate);

    return paginate(
      this.ticketModel,
      combineFilters(
        filter,
        buildSearchFilter(query.search, ['code', 'title', 'description']),
        onlyMine ? {} : this.scopeFilter(user),
      ),
      query,
      {
        populate: TICKET_POPULATE.filter((p) => p.path !== 'timeline.by'),
        select: '-timeline',
        message: 'Lấy danh sách sự cố thành công',
      },
    );
  }

  async findOne(id: string, user: AuthUser) {
    const ticket = await this.ticketModel
      .findOne(
        combineFilters({ _id: id, isActive: true }, this.scopeFilter(user)),
      )
      .populate(TICKET_POPULATE)
      .lean();
    if (!ticket) throw new NotFoundException('Không tìm thấy sự cố');
    const repairRequests = await this.repairRequestsService.findByTicket(id);
    return createApiResponse(
      { ...ticket, repairRequests },
      'Lấy chi tiết sự cố thành công',
    );
  }

  /* =============================== Báo sự cố =============================== */

  async create(dto: CreateTicketDto, user: AuthUser) {
    let asset = null;
    if (dto.assetId) {
      asset = await this.assetsService.getActiveAsset(dto.assetId);
      await this.assetsService.ensureNotFinal(asset);
      const open = await this.ticketModel
        .findOne({ assetId: asset._id, status: { $in: OPEN_TICKET_STATUSES } })
        .select('code');
      if (open) {
        throw new ConflictException(
          `Tài sản ${asset.assetCode} đang có sự cố ${open.code} chưa xử lý xong, vui lòng theo dõi sự cố này`,
        );
      }
    }
    const incidentType = dto.incidentTypeId
      ? await this.incidentTypesService.findEntity(dto.incidentTypeId)
      : null;

    const ticket = await this.ticketModel.create({
      ...dto,
      code: await this.counterService.nextCode('TK', { period: 'MONTH' }),
      reportedBy: user.id,
      departmentId: asset?.departmentId ?? user.departmentId ?? undefined,
      priority: dto.priority ?? incidentType?.defaultPriority,
      source: dto.source ?? TicketSource.WEB,
      status: TicketStatus.NEW,
      timeline: [
        {
          action: 'CREATED',
          status: TicketStatus.NEW,
          by: user.id,
          note: 'Báo sự cố',
        },
      ],
      createdBy: user.id,
    });

    if (asset) {
      await this.historyService.log({
        assetId: asset._id,
        action: AssetHistoryAction.INCIDENT_REPORTED,
        description: `Báo sự cố ${ticket.code}: ${ticket.title}`,
        refType: RefType.TICKET,
        refId: ticket._id,
        performedBy: user.id,
      });
    }
    await this.notificationsService.notifyPermission(
      PERMISSIONS.TICKET_RECEIVE,
      this.payload(
        ticket,
        NotificationType.TICKET_CREATED,
        `Sự cố mới ${ticket.code}: ${ticket.title}`,
        asset ? `Tài sản ${asset.assetCode}` : undefined,
      ),
      { excludeUserId: user.id },
    );
    return this.findOne(String(ticket._id), user).then((r) => ({
      ...r,
      statusCode: HttpStatus.CREATED,
      message: `Đã gửi báo cáo sự cố ${ticket.code}`,
    }));
  }

  /* =============================== Tiếp nhận & phân công =============================== */

  async receive(id: string, dto: ReceiveTicketDto, user: AuthUser) {
    const ticket = await this.getTicket(id);
    assertTransition('receive', ticket.status);
    const incidentType = await this.incidentTypesService.findEntity(
      dto.incidentTypeId,
    );
    const now = new Date();

    ticket.incidentTypeId = incidentType._id as Types.ObjectId;
    ticket.priority = dto.priority ?? incidentType.defaultPriority;
    ticket.receivedBy = new Types.ObjectId(user.id);
    ticket.receivedAt = now;
    ticket.dueAt = new Date(
      now.getTime() + incidentType.slaHours * 3600 * 1000,
    );
    ticket.status = TicketStatus.RECEIVED;
    this.pushTimeline(
      ticket,
      'RECEIVED',
      user.id,
      dto.note || `Phân loại: ${incidentType.name}`,
    );

    if (dto.assigneeId) {
      await this.applyAssignment(ticket, dto.assigneeId, user);
    }
    await ticket.save();

    await this.notificationsService.notifyUsers(
      [ticket.reportedBy],
      this.payload(
        ticket,
        NotificationType.TICKET_UPDATED,
        `Sự cố ${ticket.code} đã được tiếp nhận`,
      ),
      user.id,
    );
    return this.findOne(id, user).then((r) => ({
      ...r,
      message: 'Tiếp nhận sự cố thành công',
    }));
  }

  async assign(id: string, dto: AssignTicketDto, user: AuthUser) {
    const ticket = await this.getTicket(id);
    assertTransition('assign', ticket.status);
    if (!ticket.receivedAt) {
      const slaHours = await this.settingsService.get<number>(
        SettingKey.TICKET_SLA_DEFAULT_HOURS,
      );
      ticket.receivedAt = new Date();
      ticket.receivedBy = new Types.ObjectId(user.id);
      ticket.dueAt =
        ticket.dueAt ?? new Date(Date.now() + slaHours * 3600 * 1000);
    }
    await this.applyAssignment(ticket, dto.assigneeId, user, dto.note);
    await ticket.save();
    return this.findOne(id, user).then((r) => ({
      ...r,
      message: 'Phân công kỹ thuật viên thành công',
    }));
  }

  private async applyAssignment(
    ticket: Ticket,
    assigneeId: string,
    user: AuthUser,
    note?: string,
  ) {
    if (
      assigneeId !== user.id &&
      !hasPermission(user, PERMISSIONS.TICKET_ASSIGN)
    ) {
      throw new ForbiddenException('Bạn chỉ có thể tự nhận xử lý sự cố');
    }
    const technicianIds = await this.usersService.findIdsByPermission(
      PERMISSIONS.TICKET_PROCESS,
      {
        includeAdmin: true,
      },
    );
    if (!technicianIds.some((tid) => String(tid) === assigneeId)) {
      throw new BadRequestException(
        'Người được phân công không có quyền xử lý sự cố',
      );
    }
    const assignee = await this.usersService.getActiveUser(assigneeId);
    ticket.assigneeId = assignee._id as Types.ObjectId;
    ticket.assignedBy = new Types.ObjectId(user.id);
    ticket.assignedAt = new Date();
    ticket.status = TicketStatus.ASSIGNED;
    this.pushTimeline(
      ticket,
      'ASSIGNED',
      user.id,
      note || `Phân công cho ${assignee.fullName}`,
    );

    await this.notificationsService.notifyUsers(
      [assignee._id],
      this.payload(
        ticket,
        NotificationType.TICKET_ASSIGNED,
        `Bạn được giao xử lý sự cố ${ticket.code}: ${ticket.title}`,
      ),
      user.id,
    );
  }

  /* =============================== Xử lý (KTV) =============================== */

  async start(id: string, user: AuthUser) {
    const ticket = await this.getTicket(id);
    assertTransition('start', ticket.status);
    this.ensureAssignee(ticket, user);

    ticket.status = TicketStatus.IN_PROGRESS;
    ticket.startedAt = ticket.startedAt ?? new Date();
    this.pushTimeline(ticket, 'STARTED', user.id, 'Bắt đầu xử lý');
    await ticket.save();

    if (ticket.assetId) {
      const asset = await this.assetsService.getActiveAsset(ticket.assetId);
      const res = await this.assetsService.moveToService(
        asset,
        SystemAssetStatus.UNDER_REPAIR,
      );
      if (res.changed) {
        await this.historyService.log({
          assetId: asset._id,
          action: AssetHistoryAction.STATUS_CHANGED,
          description: `Đưa vào sửa chữa theo sự cố ${ticket.code}`,
          fromStatusId: res.fromStatusId,
          toStatusId: res.toStatusId,
          refType: RefType.TICKET,
          refId: ticket._id,
          performedBy: user.id,
        });
      }
    }
    await this.notifyReporter(
      ticket,
      user,
      `Sự cố ${ticket.code} đang được xử lý`,
    );
    return this.findOne(id, user).then((r) => ({
      ...r,
      message: 'Đã bắt đầu xử lý',
    }));
  }

  async addNote(id: string, dto: TicketNoteDto, user: AuthUser) {
    const ticket = await this.getTicket(id);
    assertTransition('note', ticket.status);
    const isReporter = String(ticket.reportedBy) === user.id;
    const isAssignee = String(ticket.assigneeId) === user.id;
    if (
      !isReporter &&
      !isAssignee &&
      !hasPermission(user, PERMISSIONS.TICKET_PROCESS)
    ) {
      throw new ForbiddenException('Bạn không có quyền cập nhật sự cố này');
    }
    this.pushTimeline(ticket, 'NOTE', user.id, dto.note);
    await ticket.save();
    await this.notificationsService.notifyUsers(
      [ticket.reportedBy, ticket.assigneeId],
      this.payload(
        ticket,
        NotificationType.TICKET_UPDATED,
        `Cập nhật sự cố ${ticket.code}`,
        dto.note,
      ),
      user.id,
    );
    return this.findOne(id, user).then((r) => ({
      ...r,
      message: 'Đã cập nhật tiến độ',
    }));
  }

  async diagnose(id: string, dto: DiagnosisDto, user: AuthUser) {
    const ticket = await this.getTicket(id);
    assertTransition('diagnose', ticket.status);
    this.ensureAssignee(ticket, user);
    ticket.diagnosis = dto.diagnosis;
    if (dto.rootCause) ticket.rootCause = dto.rootCause;
    this.pushTimeline(
      ticket,
      'DIAGNOSED',
      user.id,
      `Kết quả kiểm tra: ${dto.diagnosis}`,
    );
    await ticket.save();
    return this.findOne(id, user).then((r) => ({
      ...r,
      message: 'Đã ghi nhận kết quả kiểm tra',
    }));
  }

  async useParts(id: string, dto: UsePartsDto, user: AuthUser) {
    const ticket = await this.getTicket(id);
    assertTransition('useParts', ticket.status);
    this.ensureAssignee(ticket, user);

    const used = await this.sparePartsService.consume(dto.items, {
      refType: RefType.TICKET,
      refId: ticket._id,
      assetId: ticket.assetId,
      performedBy: user.id,
      note: dto.note || `Xuất cho sự cố ${ticket.code}`,
    });
    ticket.partsUsed.push(...used);
    ticket.partsCost = ticket.partsUsed.reduce(
      (s, p) => s + p.quantity * p.unitCost,
      0,
    );
    ticket.totalCost =
      ticket.partsCost + ticket.laborCost + ticket.externalCost;
    const summary = used.map((u) => `${u.name} x${u.quantity}`).join(', ');
    this.pushTimeline(
      ticket,
      'PARTS_USED',
      user.id,
      `Sử dụng vật tư: ${summary}`,
    );
    await ticket.save();

    if (ticket.assetId) {
      await this.historyService.log({
        assetId: ticket.assetId,
        action: AssetHistoryAction.PART_REPLACED,
        description: `Thay linh kiện (${ticket.code}): ${summary}`,
        cost: used.reduce((s, p) => s + p.quantity * p.unitCost, 0),
        refType: RefType.TICKET,
        refId: ticket._id,
        performedBy: user.id,
      });
    }
    return this.findOne(id, user).then((r) => ({
      ...r,
      message: 'Đã cập nhật vật tư tiêu hao',
    }));
  }

  async requestRepair(id: string, dto: CreateRepairRequestDto, user: AuthUser) {
    const ticket = await this.getTicket(id);
    assertTransition('requestRepair', ticket.status);
    this.ensureAssignee(ticket, user);

    const request = await this.repairRequestsService.createForTicket(
      ticket,
      dto,
      user,
    );
    ticket.status = TicketStatus.PENDING_APPROVAL;
    this.pushTimeline(
      ticket,
      'REPAIR_REQUESTED',
      user.id,
      `Tạo đề xuất ${request.code}: ${dto.reason}`,
    );
    await ticket.save();
    await this.notifyReporter(
      ticket,
      user,
      `Sự cố ${ticket.code} đang chờ duyệt đề xuất sửa chữa / thay thế`,
    );
    return createApiResponse(
      request,
      'Đã gửi đề xuất, chờ quản lý tài sản phê duyệt',
      HttpStatus.CREATED,
    );
  }

  async resolve(id: string, dto: ResolveTicketDto, user: AuthUser) {
    const ticket = await this.getTicket(id);
    assertTransition('resolve', ticket.status);
    this.ensureAssignee(ticket, user);
    const now = new Date();

    ticket.resolutionType = dto.resolutionType;
    ticket.resolution = dto.resolution;
    if (dto.rootCause) ticket.rootCause = dto.rootCause;
    ticket.laborCost = dto.laborCost ?? ticket.laborCost ?? 0;
    ticket.externalCost = dto.externalCost ?? ticket.externalCost ?? 0;
    ticket.totalCost =
      ticket.partsCost + ticket.laborCost + ticket.externalCost;
    ticket.resolvedAt = now;
    ticket.slaBreached = !!ticket.dueAt && now > ticket.dueAt;
    ticket.status = TicketStatus.RESOLVED;
    this.pushTimeline(ticket, 'RESOLVED', user.id, dto.resolution);
    await ticket.save();

    if (ticket.assetId) {
      const asset = await this.assetsService.getActiveAsset(ticket.assetId);
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
      await this.historyService.log({
        assetId: asset._id,
        action: AssetHistoryAction.REPAIRED,
        description: `Xử lý sự cố ${ticket.code}: ${dto.resolution}`,
        fromStatusId,
        toStatusId,
        cost: ticket.totalCost,
        refType: RefType.TICKET,
        refId: ticket._id,
        performedBy: user.id,
      });
    }

    await this.notificationsService.notifyUsers(
      [ticket.reportedBy],
      this.payload(
        ticket,
        NotificationType.TICKET_RESOLVED,
        `Sự cố ${ticket.code} đã xử lý xong, vui lòng nghiệm thu`,
        dto.resolution,
      ),
      user.id,
    );
    return this.findOne(id, user).then((r) => ({
      ...r,
      message: 'Đã ghi nhận kết quả xử lý',
    }));
  }

  /* =============================== Người báo =============================== */

  async accept(id: string, dto: AcceptTicketDto, user: AuthUser) {
    const ticket = await this.getTicket(id);
    assertTransition('accept', ticket.status);
    this.ensureReporter(ticket, user);
    const now = new Date();
    ticket.acceptance = {
      accepted: true,
      rating: dto.rating,
      feedback: dto.feedback,
      auto: false,
      at: now,
    };
    ticket.closedAt = now;
    ticket.status = TicketStatus.CLOSED;
    this.pushTimeline(
      ticket,
      'CLOSED',
      user.id,
      `Nghiệm thu: ${dto.rating}★${dto.feedback ? ` - ${dto.feedback}` : ''}`,
    );
    await ticket.save();
    await this.notificationsService.notifyUsers(
      [ticket.assigneeId],
      this.payload(
        ticket,
        NotificationType.TICKET_CLOSED,
        `Sự cố ${ticket.code} đã được nghiệm thu (${dto.rating}★)`,
        dto.feedback,
      ),
      user.id,
    );
    return this.findOne(id, user).then((r) => ({
      ...r,
      message: 'Xác nhận nghiệm thu thành công',
    }));
  }

  async reopen(id: string, dto: TicketNoteDto, user: AuthUser) {
    const ticket = await this.getTicket(id);
    assertTransition('reopen', ticket.status);
    this.ensureReporter(ticket, user);
    ticket.reopenCount += 1;
    ticket.acceptance = {
      accepted: false,
      feedback: dto.note,
      auto: false,
      at: new Date(),
    };
    ticket.resolvedAt = undefined;
    ticket.status = TicketStatus.REOPENED;
    this.pushTimeline(ticket, 'REOPENED', user.id, dto.note);
    await ticket.save();
    await this.notificationsService.notifyUsers(
      [ticket.assigneeId],
      this.payload(
        ticket,
        NotificationType.TICKET_REOPENED,
        `Sự cố ${ticket.code} bị mở lại: chưa đạt yêu cầu`,
        dto.note,
      ),
      user.id,
    );
    return this.findOne(id, user).then((r) => ({
      ...r,
      message: 'Đã mở lại sự cố',
    }));
  }

  async cancel(id: string, dto: OptionalNoteDto, user: AuthUser) {
    const ticket = await this.getTicket(id);
    assertTransition('cancel', ticket.status);
    const isReporter = String(ticket.reportedBy) === user.id;
    if (!isReporter && !hasPermission(user, PERMISSIONS.TICKET_RECEIVE)) {
      throw new ForbiddenException('Bạn không có quyền huỷ sự cố này');
    }
    if (!isReporter && !dto.note) {
      throw new BadRequestException('Vui lòng nhập lý do từ chối');
    }
    ticket.status = TicketStatus.CANCELLED;
    ticket.cancelReason = dto.note;
    ticket.closedAt = new Date();
    this.pushTimeline(
      ticket,
      isReporter ? 'CANCELLED' : 'REJECTED',
      user.id,
      dto.note,
    );
    await ticket.save();
    await this.notifyReporter(
      ticket,
      user,
      `Sự cố ${ticket.code} đã bị từ chối`,
      dto.note,
    );
    return this.findOne(id, user).then((r) => ({
      ...r,
      message: 'Đã huỷ sự cố',
    }));
  }

  /* =============================== Tác vụ nền =============================== */

  /** Tự động nghiệm thu sự cố RESOLVED quá N ngày mà người báo chưa xác nhận */
  async autoClose(days: number): Promise<number> {
    if (!days || days <= 0) return 0;
    const tickets = await this.ticketModel.find({
      status: TicketStatus.RESOLVED,
      resolvedAt: { $lte: addDays(new Date(), -days) },
    });
    for (const ticket of tickets) {
      const now = new Date();
      ticket.status = TicketStatus.CLOSED;
      ticket.closedAt = now;
      ticket.acceptance = { accepted: true, auto: true, at: now };
      this.pushTimeline(
        ticket,
        'AUTO_CLOSED',
        undefined,
        `Tự động nghiệm thu sau ${days} ngày`,
      );
      await ticket.save();
    }
    return tickets.length;
  }

  /* =============================== Helpers =============================== */

  private async getTicket(id: string) {
    const ticket = await this.ticketModel.findOne({ _id: id, isActive: true });
    if (!ticket) throw new NotFoundException('Không tìm thấy sự cố');
    return ticket;
  }

  private ensureAssignee(ticket: Ticket, user: AuthUser) {
    if (
      String(ticket.assigneeId) !== user.id &&
      !user.permissions.includes(ALL_PERMISSIONS)
    ) {
      throw new ForbiddenException(
        'Chỉ kỹ thuật viên được phân công mới thực hiện được thao tác này',
      );
    }
  }

  private ensureReporter(ticket: Ticket, user: AuthUser) {
    if (
      String(ticket.reportedBy) !== user.id &&
      !user.permissions.includes(ALL_PERMISSIONS)
    ) {
      throw new ForbiddenException(
        'Chỉ người báo sự cố mới thực hiện được thao tác này',
      );
    }
  }

  pushTimeline(
    ticket: Ticket,
    action: string,
    by: string | undefined,
    note?: string,
  ) {
    ticket.timeline.push({
      action,
      status: ticket.status,
      by: by ? new Types.ObjectId(by) : undefined,
      note,
      at: new Date(),
    });
  }

  private payload(
    ticket: Ticket,
    type: NotificationType,
    title: string,
    content?: string,
  ): NotifyPayload {
    return {
      type,
      title,
      content: content ?? `Trạng thái: ${TICKET_STATUS_LABEL[ticket.status]}`,
      refType: RefType.TICKET,
      refId: ticket._id,
    };
  }

  private notifyReporter(
    ticket: Ticket,
    user: AuthUser,
    title: string,
    content?: string,
  ) {
    return this.notificationsService.notifyUsers(
      [ticket.reportedBy],
      this.payload(ticket, NotificationType.TICKET_UPDATED, title, content),
      user.id,
    );
  }
}

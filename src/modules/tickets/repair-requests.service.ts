import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { PERMISSIONS } from '../../common/constants/permissions.constant';
import { RefType } from '../../common/constants/system-codes';
import { CounterService } from '../../common/counters/counter.service';
import { AuthUser } from '../../common/interfaces/auth-user.interface';
import { combineFilters } from '../../common/utils/data-scope.util';
import { paginate } from '../../common/utils/paginate.util';
import { buildSearchFilter } from '../../common/utils/regex.util';
import { createApiResponse } from '../../common/utils/response.util';
import { NotificationType } from '../notifications/schemas/notification.schema';
import { NotificationsService } from '../notifications/notifications.service';
import { SparePartsService } from '../spare-parts/spare-parts.service';
import {
  CreateRepairRequestDto,
  RepairDecisionDto,
  RepairRequestQueryDto,
} from './dto/ticket.dto';
import {
  RepairRequest,
  RepairRequestStatus,
  RepairRequestType,
} from './schemas/repair-request.schema';
import { Ticket, TicketStatus } from './schemas/ticket.schema';

export const REPAIR_TYPE_LABEL: Record<RepairRequestType, string> = {
  [RepairRequestType.EXTERNAL_REPAIR]: 'Sửa chữa bên ngoài',
  [RepairRequestType.REPLACE_PART]: 'Thay linh kiện',
  [RepairRequestType.REPLACE_DEVICE]: 'Thay thiết bị',
  [RepairRequestType.UPGRADE]: 'Nâng cấp',
};

const REPAIR_POPULATE = [
  { path: 'ticketId', select: 'code title status assigneeId' },
  { path: 'assetId', select: 'assetCode name serialNumber' },
  { path: 'items.sparePartId', select: 'code name unit quantity' },
  { path: 'proposedBy', select: 'employeeCode fullName' },
  { path: 'decidedBy', select: 'employeeCode fullName' },
];

@Injectable()
export class RepairRequestsService {
  constructor(
    @InjectModel(RepairRequest.name)
    private readonly repairModel: Model<RepairRequest>,
    @InjectModel(Ticket.name) private readonly ticketModel: Model<Ticket>,
    private readonly counterService: CounterService,
    private readonly sparePartsService: SparePartsService,
    private readonly notificationsService: NotificationsService,
  ) {}

  async createForTicket(
    ticket: Ticket,
    dto: CreateRepairRequestDto,
    user: AuthUser,
  ) {
    const pending = await this.repairModel.exists({
      ticketId: ticket._id,
      status: RepairRequestStatus.PENDING,
    });
    if (pending) {
      throw new BadRequestException('Sự cố đang có đề xuất chờ duyệt');
    }
    for (const item of dto.items) {
      if (item.sparePartId)
        await this.sparePartsService.findEntity(item.sparePartId);
    }
    const request = await this.repairModel.create({
      ...dto,
      code: await this.counterService.nextCode('DX', { period: 'MONTH' }),
      ticketId: ticket._id,
      assetId: ticket.assetId,
      estimatedCost: dto.items.reduce(
        (s, i) => s + i.quantity * i.estimatedCost,
        0,
      ),
      proposedBy: user.id,
      createdBy: user.id,
    });
    await this.notificationsService.notifyPermission(
      PERMISSIONS.REPAIR_REQUEST_APPROVE,
      {
        type: NotificationType.REPAIR_REQUEST_PENDING,
        title: `Đề xuất ${REPAIR_TYPE_LABEL[dto.type].toLowerCase()} ${request.code} chờ duyệt`,
        content: `Sự cố ${ticket.code} — dự kiến ${request.estimatedCost.toLocaleString('vi-VN')}đ: ${dto.reason}`,
        refType: RefType.REPAIR_REQUEST,
        refId: request._id,
      },
      { excludeUserId: user.id },
    );
    return request;
  }

  findByTicket(ticketId: string) {
    return this.repairModel
      .find({ ticketId })
      .populate(REPAIR_POPULATE.filter((p) => p.path !== 'ticketId'))
      .sort({ createdAt: -1 })
      .lean();
  }

  async findAll(query: RepairRequestQueryDto) {
    const filter: Record<string, any> = { isActive: true };
    if (query.status) filter.status = query.status;
    if (query.type) filter.type = query.type;
    if (query.ticketId) filter.ticketId = new Types.ObjectId(query.ticketId);
    if (query.assetId) filter.assetId = new Types.ObjectId(query.assetId);
    return paginate(
      this.repairModel,
      combineFilters(
        filter,
        buildSearchFilter(query.search, ['code', 'reason', 'vendor']),
      ),
      query,
      {
        populate: REPAIR_POPULATE,
        message: 'Lấy danh sách đề xuất thành công',
      },
    );
  }

  async findOne(id: string) {
    const request = await this.repairModel
      .findOne({ _id: id, isActive: true })
      .populate(REPAIR_POPULATE)
      .lean();
    if (!request) throw new NotFoundException('Không tìm thấy đề xuất');
    return createApiResponse(request, 'Lấy chi tiết đề xuất thành công');
  }

  approve(id: string, dto: RepairDecisionDto, user: AuthUser) {
    return this.decide(id, RepairRequestStatus.APPROVED, dto.note, user);
  }

  reject(id: string, dto: RepairDecisionDto, user: AuthUser) {
    if (!dto.note) throw new BadRequestException('Vui lòng nhập lý do từ chối');
    return this.decide(id, RepairRequestStatus.REJECTED, dto.note, user);
  }

  private async decide(
    id: string,
    status: RepairRequestStatus.APPROVED | RepairRequestStatus.REJECTED,
    note: string | undefined,
    user: AuthUser,
  ) {
    const request = await this.repairModel.findOne({ _id: id, isActive: true });
    if (!request) throw new NotFoundException('Không tìm thấy đề xuất');
    if (request.status !== RepairRequestStatus.PENDING) {
      throw new BadRequestException('Đề xuất đã được xử lý');
    }
    request.status = status;
    request.decidedBy = new Types.ObjectId(user.id);
    request.decidedAt = new Date();
    request.decisionNote = note;
    await request.save();

    const approved = status === RepairRequestStatus.APPROVED;
    const ticket = await this.ticketModel.findById(request.ticketId);
    if (ticket && ticket.status === TicketStatus.PENDING_APPROVAL) {
      ticket.status = TicketStatus.IN_PROGRESS;
      ticket.timeline.push({
        action: approved ? 'REPAIR_APPROVED' : 'REPAIR_REJECTED',
        status: ticket.status,
        by: new Types.ObjectId(user.id),
        note: `${approved ? 'Duyệt' : 'Từ chối'} đề xuất ${request.code}${note ? `: ${note}` : ''}`,
        at: new Date(),
      });
      await ticket.save();
    }

    await this.notificationsService.notifyUsers(
      [request.proposedBy, ticket?.assigneeId],
      {
        type: NotificationType.REPAIR_REQUEST_DECIDED,
        title: `Đề xuất ${request.code} ${approved ? 'đã được duyệt' : 'bị từ chối'}`,
        content: note,
        refType: RefType.TICKET,
        refId: request.ticketId,
      },
      user.id,
    );
    return this.findOne(id).then((r) => ({
      ...r,
      message: approved ? 'Đã duyệt đề xuất' : 'Đã từ chối đề xuất',
    }));
  }
}

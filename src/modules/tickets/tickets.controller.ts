import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Put,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { PERMISSIONS } from '../../common/constants/permissions.constant';
import {
  CurrentUser,
  RequirePermissions,
} from '../../common/decorators/auth.decorators';
import { AuthUser } from '../../common/interfaces/auth-user.interface';
import { ParseObjectIdPipe } from '../../common/pipes/parse-object-id.pipe';
import { UsePartsDto } from '../spare-parts/dto/spare-part.dto';
import {
  AcceptTicketDto,
  AssignTicketDto,
  CreateRepairRequestDto,
  CreateTicketDto,
  DiagnosisDto,
  OptionalNoteDto,
  ReceiveTicketDto,
  RepairDecisionDto,
  RepairRequestQueryDto,
  ResolveTicketDto,
  TicketNoteDto,
  TicketQueryDto,
} from './dto/ticket.dto';
import { RepairRequestsService } from './repair-requests.service';
import { TicketsService } from './tickets.service';

type Id = string;

@ApiTags('Tickets (Sự cố / Helpdesk)')
@ApiBearerAuth('access-token')
@Controller('tickets')
export class TicketsController {
  constructor(private readonly service: TicketsService) {}

  /* ---------------------- Tra cứu ---------------------- */

  @ApiOperation({
    summary:
      'Danh sách sự cố (giới hạn theo quyền). ?assignee=me|unassigned, ?overdue=true',
  })
  @Get()
  findAll(@Query() query: TicketQueryDto, @CurrentUser() user: AuthUser) {
    return this.service.findAll(query, user);
  }

  @ApiOperation({ summary: 'Lịch sử yêu cầu / sự cố tôi đã báo' })
  @Get('my')
  findMine(@Query() query: TicketQueryDto, @CurrentUser() user: AuthUser) {
    return this.service.findAll(query, user, true);
  }

  @ApiOperation({
    summary: 'Chi tiết sự cố + timeline + đề xuất liên quan (theo dõi tiến độ)',
  })
  @Get(':id')
  findOne(
    @Param('id', ParseObjectIdPipe) id: Id,
    @CurrentUser() user: AuthUser,
  ) {
    return this.service.findOne(id, user);
  }

  /* ---------------------- Người dùng ---------------------- */

  @ApiOperation({ summary: 'Báo cáo sự cố (có thể kèm assetId từ QR, ảnh)' })
  @RequirePermissions(PERMISSIONS.TICKET_CREATE)
  @HttpCode(HttpStatus.CREATED)
  @Post()
  create(@Body() dto: CreateTicketDto, @CurrentUser() user: AuthUser) {
    return this.service.create(dto, user);
  }

  @ApiOperation({ summary: 'Xác nhận nghiệm thu sửa chữa (người báo)' })
  @HttpCode(HttpStatus.OK)
  @Post(':id/accept')
  accept(
    @Param('id', ParseObjectIdPipe) id: Id,
    @Body() dto: AcceptTicketDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.service.accept(id, dto, user);
  }

  @ApiOperation({ summary: 'Không đạt — mở lại sự cố (người báo)' })
  @HttpCode(HttpStatus.OK)
  @Post(':id/reopen')
  reopen(
    @Param('id', ParseObjectIdPipe) id: Id,
    @Body() dto: TicketNoteDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.service.reopen(id, dto, user);
  }

  @ApiOperation({
    summary: 'Huỷ (người báo) / từ chối (KTV, bắt buộc lý do) khi chưa xử lý',
  })
  @HttpCode(HttpStatus.OK)
  @Post(':id/cancel')
  cancel(
    @Param('id', ParseObjectIdPipe) id: Id,
    @Body() dto: OptionalNoteDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.service.cancel(id, dto, user);
  }

  @ApiOperation({ summary: 'Cập nhật / trao đổi tiến độ xử lý' })
  @HttpCode(HttpStatus.OK)
  @Post(':id/notes')
  addNote(
    @Param('id', ParseObjectIdPipe) id: Id,
    @Body() dto: TicketNoteDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.service.addNote(id, dto, user);
  }

  /* ---------------------- Kỹ thuật viên ---------------------- */

  @ApiOperation({
    summary: 'Tiếp nhận & phân loại sự cố (có thể phân công luôn)',
  })
  @RequirePermissions(PERMISSIONS.TICKET_RECEIVE)
  @HttpCode(HttpStatus.OK)
  @Post(':id/receive')
  receive(
    @Param('id', ParseObjectIdPipe) id: Id,
    @Body() dto: ReceiveTicketDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.service.receive(id, dto, user);
  }

  @ApiOperation({ summary: 'Phân công / chuyển kỹ thuật viên' })
  @RequirePermissions(PERMISSIONS.TICKET_ASSIGN, PERMISSIONS.TICKET_RECEIVE)
  @HttpCode(HttpStatus.OK)
  @Post(':id/assign')
  assign(
    @Param('id', ParseObjectIdPipe) id: Id,
    @Body() dto: AssignTicketDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.service.assign(id, dto, user);
  }

  @ApiOperation({
    summary: 'Bắt đầu xử lý (tài sản chuyển sang Đang sửa chữa)',
  })
  @RequirePermissions(PERMISSIONS.TICKET_PROCESS)
  @HttpCode(HttpStatus.OK)
  @Post(':id/start')
  start(@Param('id', ParseObjectIdPipe) id: Id, @CurrentUser() user: AuthUser) {
    return this.service.start(id, user);
  }

  @ApiOperation({ summary: 'Ghi nhận kết quả kiểm tra thiết bị' })
  @RequirePermissions(PERMISSIONS.TICKET_PROCESS)
  @Put(':id/diagnosis')
  diagnose(
    @Param('id', ParseObjectIdPipe) id: Id,
    @Body() dto: DiagnosisDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.service.diagnose(id, dto, user);
  }

  @ApiOperation({ summary: 'Cập nhật vật tư tiêu hao (xuất kho linh kiện)' })
  @RequirePermissions(PERMISSIONS.SPARE_PART_CONSUME)
  @HttpCode(HttpStatus.OK)
  @Post(':id/parts')
  useParts(
    @Param('id', ParseObjectIdPipe) id: Id,
    @Body() dto: UsePartsDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.service.useParts(id, dto, user);
  }

  @ApiOperation({ summary: 'Tạo đề xuất sửa chữa / thay thế cần duyệt' })
  @RequirePermissions(PERMISSIONS.REPAIR_REQUEST_CREATE)
  @HttpCode(HttpStatus.CREATED)
  @Post(':id/repair-requests')
  requestRepair(
    @Param('id', ParseObjectIdPipe) id: Id,
    @Body() dto: CreateRepairRequestDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.service.requestRepair(id, dto, user);
  }

  @ApiOperation({
    summary: 'Ghi nhận kết quả sửa chữa (chuyển chờ nghiệm thu)',
  })
  @RequirePermissions(PERMISSIONS.TICKET_PROCESS)
  @HttpCode(HttpStatus.OK)
  @Post(':id/resolve')
  resolve(
    @Param('id', ParseObjectIdPipe) id: Id,
    @Body() dto: ResolveTicketDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.service.resolve(id, dto, user);
  }
}

@ApiTags('Repair Requests (Đề xuất sửa chữa / thay thế)')
@ApiBearerAuth('access-token')
@Controller('repair-requests')
export class RepairRequestsController {
  constructor(private readonly service: RepairRequestsService) {}

  @ApiOperation({
    summary: 'Danh sách đề xuất (?status=PENDING để lấy đề xuất chờ duyệt)',
  })
  @RequirePermissions(
    PERMISSIONS.REPAIR_REQUEST_READ,
    PERMISSIONS.REPAIR_REQUEST_APPROVE,
  )
  @Get()
  findAll(@Query() query: RepairRequestQueryDto) {
    return this.service.findAll(query);
  }

  @RequirePermissions(
    PERMISSIONS.REPAIR_REQUEST_READ,
    PERMISSIONS.REPAIR_REQUEST_APPROVE,
  )
  @Get(':id')
  findOne(@Param('id', ParseObjectIdPipe) id: Id) {
    return this.service.findOne(id);
  }

  @ApiOperation({ summary: 'Duyệt đề xuất' })
  @RequirePermissions(PERMISSIONS.REPAIR_REQUEST_APPROVE)
  @HttpCode(HttpStatus.OK)
  @Post(':id/approve')
  approve(
    @Param('id', ParseObjectIdPipe) id: Id,
    @Body() dto: RepairDecisionDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.service.approve(id, dto, user);
  }

  @ApiOperation({ summary: 'Từ chối đề xuất (bắt buộc lý do)' })
  @RequirePermissions(PERMISSIONS.REPAIR_REQUEST_APPROVE)
  @HttpCode(HttpStatus.OK)
  @Post(':id/reject')
  reject(
    @Param('id', ParseObjectIdPipe) id: Id,
    @Body() dto: RepairDecisionDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.service.reject(id, dto, user);
  }
}

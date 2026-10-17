import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
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
import { AssetRequestsService } from './asset-requests.service';
import {
  AssetRequestQueryDto,
  CreateAssetRequestDto,
  DecisionDto,
  ExecuteAssetRequestDto,
  RejectDto,
} from './dto/asset-request.dto';

@ApiTags(
  'Asset Requests (Vòng đời: cấp phát / bàn giao / thu hồi / điều chuyển / thanh lý)',
)
@ApiBearerAuth('access-token')
@Controller('asset-requests')
export class AssetRequestsController {
  constructor(private readonly service: AssetRequestsService) {}

  @ApiOperation({
    summary:
      'Danh sách yêu cầu (?pendingMyApproval=true để lấy yêu cầu chờ tôi duyệt)',
  })
  @Get()
  findAll(@Query() query: AssetRequestQueryDto, @CurrentUser() user: AuthUser) {
    return this.service.findAll(query, user);
  }

  @ApiOperation({ summary: 'Chi tiết yêu cầu' })
  @Get(':id')
  findOne(
    @Param('id', ParseObjectIdPipe) id: string,
    @CurrentUser() user: AuthUser,
  ) {
    return this.service.findOne(id, user);
  }

  @ApiOperation({ summary: 'Tạo yêu cầu vòng đời tài sản' })
  @RequirePermissions(PERMISSIONS.ASSET_REQUEST_CREATE)
  @HttpCode(HttpStatus.CREATED)
  @Post()
  create(@Body() dto: CreateAssetRequestDto, @CurrentUser() user: AuthUser) {
    return this.service.create(dto, user);
  }

  @ApiOperation({ summary: 'Phê duyệt bước hiện tại' })
  @RequirePermissions(
    PERMISSIONS.ASSET_REQUEST_APPROVE_DEPARTMENT,
    PERMISSIONS.ASSET_REQUEST_APPROVE_DISPOSAL,
  )
  @HttpCode(HttpStatus.OK)
  @Post(':id/approve')
  approve(
    @Param('id', ParseObjectIdPipe) id: string,
    @Body() dto: DecisionDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.service.approve(id, dto, user);
  }

  @ApiOperation({ summary: 'Từ chối yêu cầu' })
  @RequirePermissions(
    PERMISSIONS.ASSET_REQUEST_APPROVE_DEPARTMENT,
    PERMISSIONS.ASSET_REQUEST_APPROVE_DISPOSAL,
  )
  @HttpCode(HttpStatus.OK)
  @Post(':id/reject')
  reject(
    @Param('id', ParseObjectIdPipe) id: string,
    @Body() dto: RejectDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.service.reject(id, dto, user);
  }

  @ApiOperation({
    summary: 'Thực hiện yêu cầu đã duyệt (cập nhật tài sản + ghi lịch sử)',
  })
  @RequirePermissions(PERMISSIONS.ASSET_REQUEST_EXECUTE)
  @HttpCode(HttpStatus.OK)
  @Post(':id/execute')
  execute(
    @Param('id', ParseObjectIdPipe) id: string,
    @Body() dto: ExecuteAssetRequestDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.service.execute(id, dto, user);
  }

  @ApiOperation({ summary: 'Huỷ yêu cầu (người tạo hoặc QLTS)' })
  @HttpCode(HttpStatus.OK)
  @Post(':id/cancel')
  cancel(
    @Param('id', ParseObjectIdPipe) id: string,
    @CurrentUser() user: AuthUser,
  ) {
    return this.service.cancel(id, user);
  }
}

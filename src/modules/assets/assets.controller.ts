import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Put,
  Query,
  Res,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  ApiBearerAuth,
  ApiBody,
  ApiConsumes,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { Response } from 'express';
import { PERMISSIONS } from '../../common/constants/permissions.constant';
import {
  CurrentUser,
  GetUserId,
  OptionalAuth,
  RequirePermissions,
} from '../../common/decorators/auth.decorators';
import { AuthUser } from '../../common/interfaces/auth-user.interface';
import { ParseObjectIdPipe } from '../../common/pipes/parse-object-id.pipe';
import { dateStamp, fileResponse } from '../../common/utils/file-response.util';
import { AssetsExcelService } from './assets-excel.service';
import { AssetsService } from './assets.service';
import {
  AssetHistoryQueryDto,
  AssetQueryDto,
  ChangeAssetStatusDto,
  CreateAssetDto,
  QrBatchDto,
  QrQueryDto,
  UpdateAssetDto,
} from './dto/asset.dto';
import { QrService } from './qr.service';

@ApiTags('Assets (Tài sản)')
@ApiBearerAuth('access-token')
@Controller('assets')
export class AssetsController {
  constructor(
    private readonly assetsService: AssetsService,
    private readonly excelService: AssetsExcelService,
    private readonly qrService: QrService,
  ) {}

  /* ---------------------- Tra cứu ---------------------- */

  @ApiOperation({
    summary:
      'Danh sách tài sản (tự giới hạn theo quyền: toàn bộ / phòng ban / của tôi)',
  })
  @Get()
  findAll(@Query() query: AssetQueryDto, @CurrentUser() user: AuthUser) {
    return this.assetsService.findAll(query, user);
  }

  @ApiOperation({ summary: 'Tài sản tôi đang sử dụng' })
  @Get('my')
  findMine(@Query() query: AssetQueryDto, @GetUserId() userId: string) {
    return this.assetsService.findMine(userId, query);
  }

  @ApiOperation({ summary: 'Xuất danh sách tài sản ra Excel (theo bộ lọc)' })
  @RequirePermissions(PERMISSIONS.ASSET_IMPORT_EXPORT)
  @Get('export')
  async export(
    @Query() query: AssetQueryDto,
    @CurrentUser() user: AuthUser,
    @Res({ passthrough: true }) res: Response,
  ) {
    const buffer = await this.excelService.exportAssets(query, user);
    return fileResponse(res, buffer, `danh-sach-tai-san-${dateStamp()}.xlsx`);
  }

  @ApiOperation({ summary: 'Tải file Excel mẫu để import tài sản' })
  @RequirePermissions(PERMISSIONS.ASSET_IMPORT_EXPORT)
  @Get('import/template')
  async importTemplate(@Res({ passthrough: true }) res: Response) {
    const buffer = await this.excelService.buildTemplate();
    return fileResponse(res, buffer, 'mau-import-tai-san.xlsx');
  }

  @ApiOperation({ summary: 'Import tài sản từ Excel' })
  @RequirePermissions(PERMISSIONS.ASSET_IMPORT_EXPORT)
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: { file: { type: 'string', format: 'binary' } },
    },
  })
  @UseInterceptors(
    FileInterceptor('file', { limits: { fileSize: 10 * 1024 * 1024 } }),
  )
  @Post('import')
  importAssets(
    @UploadedFile() file: Express.Multer.File,
    @CurrentUser() user: AuthUser,
  ) {
    if (!file || !/\.xlsx$/i.test(file.originalname)) {
      throw new BadRequestException('Vui lòng chọn file .xlsx');
    }
    return this.excelService.importAssets(file, user);
  }

  @ApiOperation({ summary: 'Sinh mã QR hàng loạt (in tem)' })
  @RequirePermissions(PERMISSIONS.QR_MANAGE)
  @HttpCode(HttpStatus.OK)
  @Post('qr/batch')
  qrBatch(@Body() dto: QrBatchDto) {
    return this.qrService.batch(dto.assetIds);
  }

  @ApiOperation({ summary: 'Chi tiết tài sản' })
  @Get(':id')
  findOne(
    @Param('id', ParseObjectIdPipe) id: string,
    @CurrentUser() user: AuthUser,
  ) {
    return this.assetsService.findOne(id, user);
  }

  @ApiOperation({
    summary:
      'Lịch sử tài sản (cấp phát, điều chuyển, sửa chữa, bảo trì...). Lọc ?actions=REPAIRED,MAINTAINED',
  })
  @Get(':id/history')
  history(
    @Param('id', ParseObjectIdPipe) id: string,
    @Query() query: AssetHistoryQueryDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.assetsService.getHistory(id, query, user);
  }

  @ApiOperation({
    summary:
      'Lịch sử bảo trì của tài sản (MaintenanceTask: kế hoạch, KTV thực hiện, kết quả, chi phí)',
  })
  @Get(':id/maintenance-history')
  maintenanceHistory(
    @Param('id', ParseObjectIdPipe) id: string,
    @CurrentUser() user: AuthUser,
  ) {
    return this.assetsService.getMaintenanceHistory(id, user);
  }

  @ApiOperation({
    summary:
      'Lịch sử sửa chữa / xử lý sự cố của tài sản (Ticket: tiếp nhận, KTV xử lý, chi phí, nghiệm thu)',
  })
  @Get(':id/repair-history')
  repairHistory(
    @Param('id', ParseObjectIdPipe) id: string,
    @CurrentUser() user: AuthUser,
  ) {
    return this.assetsService.getRepairHistory(id, user);
  }

  @ApiOperation({ summary: 'Lấy mã QR (json kèm dataUrl, hoặc ?format=png)' })
  @RequirePermissions(PERMISSIONS.QR_MANAGE, PERMISSIONS.ASSET_READ_ALL)
  @Get(':id/qr')
  async getQr(
    @Param('id', ParseObjectIdPipe) id: string,
    @Query() query: QrQueryDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    if (query.format === 'png') {
      const { buffer, assetCode } = await this.qrService.getQrPng(id);
      return fileResponse(
        res,
        buffer,
        `QR-${assetCode}.png`,
        'image/png',
        true,
      );
    }
    return this.qrService.getQr(id);
  }

  /* ---------------------- Ghi dữ liệu ---------------------- */

  @ApiOperation({ summary: 'Thêm tài sản (mua mới)' })
  @RequirePermissions(PERMISSIONS.ASSET_CREATE)
  @HttpCode(HttpStatus.CREATED)
  @Post()
  create(@Body() dto: CreateAssetDto, @CurrentUser() user: AuthUser) {
    return this.assetsService.create(dto, user);
  }

  @ApiOperation({ summary: 'Cập nhật thông tin tài sản' })
  @RequirePermissions(PERMISSIONS.ASSET_UPDATE)
  @Put(':id')
  update(
    @Param('id', ParseObjectIdPipe) id: string,
    @Body() dto: UpdateAssetDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.assetsService.update(id, dto, user);
  }

  @ApiOperation({ summary: 'Đổi trạng thái tài sản (hỏng, mất...)' })
  @RequirePermissions(PERMISSIONS.ASSET_UPDATE)
  @Patch(':id/status')
  changeStatus(
    @Param('id', ParseObjectIdPipe) id: string,
    @Body() dto: ChangeAssetStatusDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.assetsService.changeStatus(id, dto, user);
  }

  @ApiOperation({ summary: 'Cấp lại mã QR (vô hiệu mã cũ)' })
  @RequirePermissions(PERMISSIONS.QR_MANAGE)
  @Post(':id/qr/regenerate')
  regenerateQr(
    @Param('id', ParseObjectIdPipe) id: string,
    @GetUserId() userId: string,
  ) {
    return this.qrService.regenerate(id, userId);
  }

  @ApiOperation({ summary: 'Xoá tài sản (chỉ khi không còn sử dụng)' })
  @RequirePermissions(PERMISSIONS.ASSET_DELETE)
  @Delete(':id')
  remove(
    @Param('id', ParseObjectIdPipe) id: string,
    @CurrentUser() user: AuthUser,
  ) {
    return this.assetsService.remove(id, user);
  }
}

@ApiTags('QR Scan (Quét mã QR)')
@Controller('qr')
export class QrScanController {
  constructor(private readonly qrService: QrService) {}

  @ApiOperation({
    summary:
      'Quét mã QR — không cần đăng nhập (thông tin rút gọn); gửi kèm Bearer token để xem chi tiết & báo sự cố',
  })
  @ApiBearerAuth('access-token')
  @OptionalAuth()
  @Get(':token')
  scan(@Param('token') token: string, @CurrentUser() user: AuthUser | null) {
    return this.qrService.scan(token, user);
  }
}

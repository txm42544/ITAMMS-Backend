import { Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectConnection, InjectModel } from '@nestjs/mongoose';
import { Connection, Model } from 'mongoose';
import * as QRCode from 'qrcode';
import { PERMISSIONS } from '../../common/constants/permissions.constant';
import { AuthUser } from '../../common/interfaces/auth-user.interface';
import { hasPermission } from '../../common/utils/permission.util';
import { createApiResponse } from '../../common/utils/response.util';
import { AssetHistoryService } from './asset-history.service';
import { ASSET_POPULATE, AssetsService } from './assets.service';
import { AssetHistoryAction } from './schemas/asset-history.schema';
import { Asset } from './schemas/asset.schema';

const QR_OPTIONS: QRCode.QRCodeToDataURLOptions = {
  errorCorrectionLevel: 'M',
  margin: 1,
  width: 320,
};

@Injectable()
export class QrService {
  private readonly frontendUrl: string;

  constructor(
    @InjectModel(Asset.name) private readonly assetModel: Model<Asset>,
    @InjectConnection() private readonly connection: Connection,
    private readonly assetsService: AssetsService,
    private readonly historyService: AssetHistoryService,
    configService: ConfigService,
  ) {
    this.frontendUrl = configService
      .get<string>('FRONTEND_URL', 'http://localhost:3000')
      .replace(/\/$/, '');
  }

  /** Nội dung mã QR: link trang quét trên FE */
  buildScanUrl(qrToken: string) {
    return `${this.frontendUrl}/scan/${qrToken}`;
  }

  async getQr(id: string) {
    const asset = await this.assetsService.getActiveAsset(id);
    const url = this.buildScanUrl(asset.qrToken);
    return createApiResponse(
      {
        assetId: asset._id,
        assetCode: asset.assetCode,
        name: asset.name,
        qrToken: asset.qrToken,
        url,
        dataUrl: await QRCode.toDataURL(url, QR_OPTIONS),
      },
      'Lấy mã QR thành công',
    );
  }

  async getQrPng(id: string): Promise<{ buffer: Buffer; assetCode: string }> {
    const asset = await this.assetsService.getActiveAsset(id);
    const buffer = await QRCode.toBuffer(this.buildScanUrl(asset.qrToken), {
      errorCorrectionLevel: 'M',
      margin: 1,
      width: 480,
    });
    return { buffer, assetCode: asset.assetCode };
  }

  /** Sinh QR hàng loạt để in tem dán tài sản */
  async batch(assetIds: string[]) {
    const assets = await this.assetModel
      .find({ _id: { $in: assetIds }, isActive: true })
      .populate([
        { path: 'categoryId', select: 'name' },
        { path: 'departmentId', select: 'name' },
      ])
      .select('assetCode name qrToken categoryId departmentId serialNumber')
      .sort({ assetCode: 1 })
      .lean();
    const data = await Promise.all(
      assets.map(async (a: any) => {
        const url = this.buildScanUrl(a.qrToken);
        return {
          assetId: a._id,
          assetCode: a.assetCode,
          name: a.name,
          serialNumber: a.serialNumber,
          category: a.categoryId?.name,
          department: a.departmentId?.name,
          url,
          dataUrl: await QRCode.toDataURL(url, QR_OPTIONS),
        };
      }),
    );
    return createApiResponse(data, `Đã tạo ${data.length} mã QR`);
  }

  /** Cấp lại mã QR (vô hiệu mã cũ khi tem bị mất / lộ) */
  async regenerate(id: string, userId: string) {
    const asset = await this.assetsService.getActiveAsset(id);
    await this.assetsService.ensureNotFinal(asset);
    asset.qrToken = AssetsService.generateQrToken();
    asset.updatedBy = userId as any;
    await asset.save();
    await this.historyService.log({
      assetId: asset._id,
      action: AssetHistoryAction.QR_REGENERATED,
      description: 'Cấp lại mã QR, mã cũ không còn hiệu lực',
      performedBy: userId,
    });
    return this.getQr(id).then((r) => ({
      ...r,
      message: 'Cấp lại mã QR thành công',
    }));
  }

  /**
   * Quét QR:
   *  - khách (chưa đăng nhập): thông tin cơ bản + yêu cầu đăng nhập để báo lỗi
   *  - đã đăng nhập: chi tiết theo quyền + lịch sử gần nhất + quyền báo sự cố
   */
  async scan(token: string, user: AuthUser | null) {
    const asset = await this.assetModel
      .findOne({ qrToken: token, isActive: true })
      .populate(ASSET_POPULATE)
      .lean<any>();
    if (!asset) {
      throw new NotFoundException('Mã QR không hợp lệ hoặc đã bị thu hồi');
    }

    const basic = {
      _id: asset._id,
      assetCode: asset.assetCode,
      name: asset.name,
      brand: asset.brand,
      deviceModel: asset.deviceModel,
      category: asset.categoryId?.name,
      status: asset.statusId
        ? {
            code: asset.statusId.code,
            name: asset.statusId.name,
            color: asset.statusId.color,
          }
        : null,
      department: asset.departmentId?.name,
      location: asset.locationId?.name,
      images: asset.images?.slice(0, 1) ?? [],
    };
    const isFinal = !!asset.statusId?.isFinal;

    if (!user) {
      return createApiResponse(
        { asset: basic, requireLogin: true, canReportIncident: false },
        'Quét mã QR thành công',
      );
    }

    const canView = this.assetsService.canView(asset, user);
    const ticketModel = this.connection.models['Ticket'];
    const [recentHistory, openTickets] = await Promise.all([
      canView ? this.historyService.findRecent(asset._id, 5) : [],
      ticketModel
        ? ticketModel
            .find({
              assetId: asset._id,
              status: { $nin: ['CLOSED', 'CANCELLED'] },
            })
            .select('code title status priority createdAt')
            .sort({ createdAt: -1 })
            .lean()
        : [],
    ]);

    return createApiResponse(
      {
        asset: canView ? asset : basic,
        fullAccess: canView,
        recentHistory,
        openTickets,
        requireLogin: false,
        canReportIncident:
          !isFinal && hasPermission(user, PERMISSIONS.TICKET_CREATE),
      },
      'Quét mã QR thành công',
    );
  }
}

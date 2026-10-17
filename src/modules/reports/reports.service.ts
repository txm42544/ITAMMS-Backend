import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import ExcelJS from 'exceljs';
import { Model, Types } from 'mongoose';
import { PERMISSIONS } from '../../common/constants/permissions.constant';
import { AuthUser } from '../../common/interfaces/auth-user.interface';
import { addDays, startOfDay } from '../../common/utils/paginate.util';
import { hasPermission } from '../../common/utils/permission.util';
import { createApiResponse } from '../../common/utils/response.util';
import { Asset } from '../assets/schemas/asset.schema';
import { Ticket, TicketStatus } from '../tickets/schemas/ticket.schema';
import { MaintenanceTask } from '../maintenance/schemas/maintenance.schemas';
import { SparePart } from '../spare-parts/schemas/spare-part.schema';
import { Department } from '../departments/schemas/department.schema';
import { User } from '../users/schemas/user.schema';
import {
  AssetCategory,
  AssetStatus,
} from '../catalogs/schemas/catalog.schemas';

export interface ReportQuery {
  fromDate?: string;
  toDate?: string;
  departmentId?: string;
}

@Injectable()
export class ReportsService {
  constructor(
    @InjectModel(Asset.name) private readonly assetModel: Model<Asset>,
    @InjectModel(Ticket.name) private readonly ticketModel: Model<Ticket>,
    @InjectModel(MaintenanceTask.name)
    private readonly taskModel: Model<MaintenanceTask>,
    @InjectModel(SparePart.name)
    private readonly sparePartModel: Model<SparePart>,
    @InjectModel(Department.name)
    private readonly departmentModel: Model<Department>,
    @InjectModel(User.name) private readonly userModel: Model<User>,
    @InjectModel(AssetCategory.name)
    private readonly categoryModel: Model<AssetCategory>,
    @InjectModel(AssetStatus.name)
    private readonly statusModel: Model<AssetStatus>,
  ) {}

  /** Áp dụng data scope theo quyền báo cáo */
  private reportScope(user: AuthUser): Record<string, any> {
    if (hasPermission(user, PERMISSIONS.REPORT_VIEW_ALL)) return {};
    if (
      hasPermission(user, PERMISSIONS.REPORT_VIEW_DEPARTMENT) &&
      user.departmentId
    ) {
      return { departmentId: new Types.ObjectId(user.departmentId) };
    }
    return { reportedBy: new Types.ObjectId(user.id) };
  }

  private buildDateRange(query: ReportQuery) {
    const from = query.fromDate
      ? startOfDay(new Date(query.fromDate))
      : startOfDay(addDays(new Date(), -30));
    const to = query.toDate
      ? new Date(new Date(query.toDate).setHours(23, 59, 59, 999))
      : new Date();
    return { from, to };
  }

  /* ===================== Dashboard tổng quan ===================== */

  async dashboard(query: ReportQuery, user: AuthUser) {
    const scope = this.reportScope(user);
    const { from, to } = this.buildDateRange(query);
    const now = new Date();

    // Phạm vi tài sản theo scope
    const assetScope = Object.keys(scope).length ? scope : {};
    const ticketScope = this.buildTicketScope(user);

    const [
      totalAssets,
      assetsByStatus,
      assetsByCategory,
      warrantyStats,
      openTickets,
      overdueTickets,
      ticketsInRange,
      maintenanceDue,
      maintenanceInRange,
      lowStock,
      totalValue,
    ] = await Promise.all([
      this.assetModel.countDocuments({ isActive: true, ...assetScope }),
      this.assetModel.aggregate([
        { $match: { isActive: true, ...assetScope } },
        { $group: { _id: '$statusId', count: { $sum: 1 } } },
      ]),
      this.assetModel.aggregate([
        { $match: { isActive: true, ...assetScope } },
        { $group: { _id: '$categoryId', count: { $sum: 1 } } },
      ]),
      this.warrantyStats(assetScope, now),
      this.ticketModel.countDocuments({
        isActive: true,
        ...ticketScope,
        status: {
          $in: [
            TicketStatus.NEW,
            TicketStatus.RECEIVED,
            TicketStatus.ASSIGNED,
            TicketStatus.IN_PROGRESS,
            TicketStatus.PENDING_APPROVAL,
            TicketStatus.REOPENED,
          ],
        },
      }),
      this.ticketModel.countDocuments({
        isActive: true,
        ...ticketScope,
        dueAt: { $lt: now },
        status: {
          $nin: [
            TicketStatus.CLOSED,
            TicketStatus.CANCELLED,
            TicketStatus.RESOLVED,
          ],
        },
      }),
      this.ticketModel.countDocuments({
        isActive: true,
        ...ticketScope,
        createdAt: { $gte: from, $lte: to },
      }),
      this.assetModel.countDocuments({
        isActive: true,
        ...assetScope,
        nextMaintenanceDate: { $lte: addDays(now, 30) },
      }),
      this.taskModel.countDocuments({
        isActive: true,
        completedAt: { $gte: from, $lte: to },
      }),
      this.sparePartModel.countDocuments({
        isActive: true,
        $expr: { $lte: ['$quantity', '$minQuantity'] },
      }),
      this.assetModel.aggregate([
        { $match: { isActive: true, ...assetScope } },
        { $group: { _id: null, total: { $sum: '$purchasePrice' } } },
      ]),
    ]);

    const statusInfo = await this.lookupStatusMap(
      assetsByStatus.map((s) => s._id),
    );
    const categoryInfo = await this.lookupCategoryMap(
      assetsByCategory.map((c) => c._id),
    );

    return createApiResponse(
      {
        assets: {
          total: totalAssets,
          totalValue: totalValue[0]?.total || 0,
          byStatus: assetsByStatus.map((s) => ({
            status: statusInfo[s._id?.toString()],
            count: s.count,
          })),
          byCategory: assetsByCategory.map((c) => ({
            category: categoryInfo[c._id?.toString()],
            count: c.count,
          })),
        },
        warranty: warrantyStats,
        tickets: {
          open: openTickets,
          overdue: overdueTickets,
          newInRange: ticketsInRange,
        },
        maintenance: {
          dueWithin30Days: maintenanceDue,
          completedInRange: maintenanceInRange,
        },
        spareParts: {
          lowStock,
        },
        period: { from, to },
      },
      'Lấy dữ liệu dashboard thành công',
    );
  }

  /* ===================== Báo cáo tài sản ===================== */

  async assetsReport(query: ReportQuery, user: AuthUser) {
    const scope = this.reportScope(user);
    const match: Record<string, any> = { isActive: true, ...scope };
    if (query.departmentId)
      match.departmentId = new Types.ObjectId(query.departmentId);
    if (query.fromDate || query.toDate) {
      match.purchaseDate = {};
      if (query.fromDate) match.purchaseDate.$gte = new Date(query.fromDate);
      if (query.toDate) match.purchaseDate.$lte = new Date(query.toDate);
    }

    const [byStatus, byCategory, byDepartment, byAge, warranty, totalValue] =
      await Promise.all([
        this.assetModel.aggregate([
          { $match: match },
          {
            $group: {
              _id: '$statusId',
              count: { $sum: 1 },
              value: { $sum: '$purchasePrice' },
            },
          },
        ]),
        this.assetModel.aggregate([
          { $match: match },
          {
            $group: {
              _id: '$categoryId',
              count: { $sum: 1 },
              value: { $sum: '$purchasePrice' },
            },
          },
        ]),
        this.assetModel.aggregate([
          { $match: match },
          {
            $group: {
              _id: '$departmentId',
              count: { $sum: 1 },
              value: { $sum: '$purchasePrice' },
            },
          },
        ]),
        this.assetAgeBreakdown(match),
        this.warrantyStats(scope, new Date()),
        this.assetModel.aggregate([
          { $match: match },
          { $group: { _id: null, total: { $sum: '$purchasePrice' } } },
        ]),
      ]);

    const statusInfo = await this.lookupStatusMap(byStatus.map((s) => s._id));
    const categoryInfo = await this.lookupCategoryMap(
      byCategory.map((c) => c._id),
    );
    const departmentInfo = await this.lookupDepartmentMap(
      byDepartment.map((d) => d._id),
    );

    return createApiResponse(
      {
        total: byStatus.reduce((s, x) => s + x.count, 0),
        totalValue: totalValue[0]?.total || 0,
        byStatus: byStatus.map((s) => ({
          status: statusInfo[s._id?.toString()],
          count: s.count,
          value: s.value,
        })),
        byCategory: byCategory.map((c) => ({
          category: categoryInfo[c._id?.toString()],
          count: c.count,
          value: c.value,
        })),
        byDepartment: byDepartment.map((d) => ({
          department: departmentInfo[d._id?.toString()],
          count: d.count,
          value: d.value,
        })),
        byAge,
        warranty,
      },
      'Lấy báo cáo tài sản thành công',
    );
  }

  /* ===================== Báo cáo chi phí bảo trì ===================== */

  async maintenanceCostReport(query: ReportQuery, user: AuthUser) {
    const scope = this.ticketScopeForReport(user);
    const { from, to } = this.buildDateRange(query);
    const dateMatch = {
      isActive: true,
      ...scope,
      completedAt: { $gte: from, $lte: to },
    };

    const [byMonth, byCategory, byDepartment, topAssets, summary] =
      await Promise.all([
        this.ticketModel.aggregate([
          { $match: dateMatch },
          {
            $group: {
              _id: {
                year: { $year: '$completedAt' },
                month: { $month: '$completedAt' },
              },
              partsCost: { $sum: '$partsCost' },
              laborCost: { $sum: '$laborCost' },
              externalCost: { $sum: '$externalCost' },
              totalCost: { $sum: '$totalCost' },
              count: { $sum: 1 },
            },
          },
          { $sort: { '_id.year': 1, '_id.month': 1 } },
        ]),
        this.ticketModel.aggregate([
          { $match: dateMatch },
          {
            $lookup: {
              from: 'assets',
              localField: 'assetId',
              foreignField: '_id',
              as: 'asset',
            },
          },
          { $unwind: { path: '$asset', preserveNullAndEmptyArrays: true } },
          {
            $lookup: {
              from: 'assetcategories',
              localField: 'asset.categoryId',
              foreignField: '_id',
              as: 'category',
            },
          },
          { $unwind: { path: '$category', preserveNullAndEmptyArrays: true } },
          {
            $group: {
              _id: '$category._id',
              name: { $first: '$category.name' },
              totalCost: { $sum: '$totalCost' },
              count: { $sum: 1 },
            },
          },
          { $sort: { totalCost: -1 } },
        ]),
        this.ticketModel.aggregate([
          { $match: dateMatch },
          {
            $group: {
              _id: '$departmentId',
              totalCost: { $sum: '$totalCost' },
              count: { $sum: 1 },
            },
          },
          { $sort: { totalCost: -1 } },
        ]),
        this.ticketModel.aggregate([
          { $match: dateMatch },
          {
            $group: {
              _id: '$assetId',
              totalCost: { $sum: '$totalCost' },
              count: { $sum: 1 },
            },
          },
          { $sort: { totalCost: -1 } },
          { $limit: 10 },
        ]),
        this.ticketModel.aggregate([
          { $match: dateMatch },
          {
            $group: {
              _id: null,
              totalParts: { $sum: '$partsCost' },
              totalLabor: { $sum: '$laborCost' },
              totalExternal: { $sum: '$externalCost' },
              total: { $sum: '$totalCost' },
              count: { $sum: 1 },
            },
          },
        ]),
      ]);

    // Lấy thông tin asset cho top
    const topAssetIds = topAssets.map((a) => a._id).filter(Boolean);
    const topAssetInfo = await this.assetModel
      .find({ _id: { $in: topAssetIds } })
      .select('assetCode name')
      .lean();
    const topAssetMap = new Map(
      topAssetInfo.map((a: any) => [String(a._id), a]),
    );
    const topAssetsWithInfo = topAssets.map((a) => ({
      asset: topAssetMap.get(String(a._id)) || null,
      totalCost: a.totalCost,
      count: a.count,
    }));

    const departmentInfo = await this.lookupDepartmentMap(
      byDepartment.map((d) => d._id),
    );

    return createApiResponse(
      {
        period: { from, to },
        summary: summary[0] || {
          totalParts: 0,
          totalLabor: 0,
          totalExternal: 0,
          total: 0,
          count: 0,
        },
        byMonth,
        byCategory,
        byDepartment: byDepartment.map((d) => ({
          department: departmentInfo[d._id?.toString()],
          totalCost: d.totalCost,
          count: d.count,
        })),
        topAssets: topAssetsWithInfo,
      },
      'Lấy báo cáo chi phí bảo trì thành công',
    );
  }

  /* ===================== Báo cáo hiệu suất IT ===================== */

  async itPerformanceReport(query: ReportQuery, user: AuthUser) {
    const scope = this.ticketScopeForReport(user);
    const { from, to } = this.buildDateRange(query);
    const match: Record<string, any> = {
      isActive: true,
      ...scope,
      createdAt: { $gte: from, $lte: to },
    };

    const [summary, byStatus, byTechnician, responseTime, slaStats, ratings] =
      await Promise.all([
        this.ticketModel.aggregate([
          { $match: match },
          {
            $group: {
              _id: null,
              total: { $sum: 1 },
              resolved: {
                $sum: { $cond: [{ $ne: ['$resolvedAt', null] }, 1, 0] },
              },
              closed: {
                $sum: { $cond: [{ $ne: ['$closedAt', null] }, 1, 0] },
              },
              breached: {
                $sum: { $cond: ['$slaBreached', 1, 0] },
              },
              totalCost: { $sum: '$totalCost' },
            },
          },
        ]),
        this.ticketModel.aggregate([
          { $match: match },
          { $group: { _id: '$status', count: { $sum: 1 } } },
        ]),
        this.ticketModel.aggregate([
          { $match: { ...match, assigneeId: { $ne: null } } },
          {
            $group: {
              _id: '$assigneeId',
              total: { $sum: 1 },
              resolved: {
                $sum: { $cond: [{ $ne: ['$resolvedAt', null] }, 1, 0] },
              },
              avgRating: { $avg: '$acceptance.rating' },
              avgResponseMs: {
                $avg: {
                  $subtract: [
                    { $ifNull: ['$startedAt', '$receivedAt'] },
                    '$createdAt',
                  ],
                },
              },
            },
          },
        ]),
        this.ticketModel.aggregate([
          { $match: { ...match, receivedAt: { $ne: null } } },
          {
            $project: {
              responseMs: { $subtract: ['$receivedAt', '$createdAt'] },
            },
          },
          {
            $group: {
              _id: null,
              avg: { $avg: '$responseMs' },
              min: { $min: '$responseMs' },
              max: { $max: '$responseMs' },
            },
          },
        ]),
        this.ticketModel.aggregate([
          { $match: { ...match, dueAt: { $ne: null } } },
          {
            $group: {
              _id: null,
              total: { $sum: 1 },
              onTime: {
                $sum: {
                  $cond: [
                    {
                      $and: [
                        '$resolvedAt',
                        { $lte: ['$resolvedAt', '$dueAt'] },
                      ],
                    },
                    1,
                    0,
                  ],
                },
              },
              breached: { $sum: { $cond: ['$slaBreached', 1, 0] } },
            },
          },
        ]),
        this.ticketModel.aggregate([
          { $match: { ...match, 'acceptance.rating': { $ne: null } } },
          {
            $group: {
              _id: null,
              avg: { $avg: '$acceptance.rating' },
              count: { $sum: 1 },
            },
          },
        ]),
      ]);

    const technicianIds = byTechnician.map((t) => t._id).filter(Boolean);
    const technicianInfo = await this.userModel
      .find({ _id: { $in: technicianIds } })
      .select('employeeCode fullName')
      .lean();
    const techMap = new Map(technicianInfo.map((u: any) => [String(u._id), u]));
    const byTechnicianWithInfo = byTechnician.map((t) => ({
      user: techMap.get(String(t._id)) || null,
      total: t.total,
      resolved: t.resolved,
      avgRating: Math.round((t.avgRating || 0) * 10) / 10,
      avgResponseHours: t.avgResponseMs
        ? Math.round((t.avgResponseMs / 3600000) * 10) / 10
        : null,
    }));

    const s = summary[0] || {
      total: 0,
      resolved: 0,
      closed: 0,
      breached: 0,
      totalCost: 0,
    };
    const sla = slaStats[0] || { total: 0, onTime: 0, breached: 0 };
    const rt = responseTime[0] || { avg: 0, min: 0, max: 0 };

    return createApiResponse(
      {
        period: { from, to },
        summary: {
          total: s.total,
          resolved: s.resolved,
          closed: s.closed,
          breached: s.breached,
          totalCost: s.totalCost,
          avgRating: ratings[0]?.avg
            ? Math.round(ratings[0].avg * 10) / 10
            : null,
        },
        byStatus,
        byTechnician: byTechnicianWithInfo,
        responseTime: {
          avgHours: rt.avg ? Math.round((rt.avg / 3600000) * 10) / 10 : 0,
          minHours: rt.min ? Math.round((rt.min / 3600000) * 10) / 10 : 0,
          maxHours: rt.max ? Math.round((rt.max / 3600000) * 10) / 10 : 0,
        },
        sla: {
          total: sla.total,
          onTime: sla.onTime,
          breached: sla.breached,
          onTimeRate: sla.total
            ? Math.round((sla.onTime / sla.total) * 1000) / 10
            : 0,
        },
      },
      'Lấy báo cáo hiệu suất IT thành công',
    );
  }

  /* ===================== Excel export ===================== */

  async exportAssets(query: ReportQuery, user: AuthUser): Promise<Buffer> {
    const scope = this.reportScope(user);
    const match: Record<string, any> = { isActive: true, ...scope };
    const assets = await this.assetModel
      .find(match)
      .populate('categoryId', 'name')
      .populate('statusId', 'name')
      .populate('departmentId', 'name')
      .populate('locationId', 'name building')
      .populate('currentUserId', 'fullName')
      .populate('supplierId', 'name')
      .sort({ assetCode: 1 })
      .limit(10000)
      .lean();

    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet('Tài sản');
    sheet.columns = [
      { header: 'STT', key: 'stt', width: 6 },
      { header: 'Mã tài sản', key: 'assetCode', width: 16 },
      { header: 'Tên tài sản', key: 'name', width: 32 },
      { header: 'Loại', key: 'category', width: 18 },
      { header: 'Trạng thái', key: 'status', width: 14 },
      { header: 'Phòng ban', key: 'department', width: 18 },
      { header: 'Vị trí', key: 'location', width: 18 },
      { header: 'Người SD', key: 'holder', width: 22 },
      { header: 'Nhà CC', key: 'supplier', width: 18 },
      { header: 'Ngày mua', key: 'purchaseDate', width: 12 },
      { header: 'Giá mua', key: 'purchasePrice', width: 14 },
      { header: 'Bảo hành', key: 'warrantyEndDate', width: 12 },
    ];
    assets.forEach((a: any, i) =>
      sheet.addRow({
        stt: i + 1,
        assetCode: a.assetCode,
        name: a.name,
        category: a.categoryId?.name,
        status: a.statusId?.name,
        department: a.departmentId?.name,
        location: a.locationId?.name,
        holder: a.currentUserId?.fullName,
        supplier: a.supplierId?.name,
        purchaseDate: a.purchaseDate,
        purchasePrice: a.purchasePrice,
        warrantyEndDate: a.warrantyEndDate,
      }),
    );
    this.styleSheet(sheet);
    sheet.getColumn('purchasePrice').numFmt = '#,##0';
    sheet.getColumn('purchaseDate').numFmt = 'dd/mm/yyyy';
    sheet.getColumn('warrantyEndDate').numFmt = 'dd/mm/yyyy';
    return Buffer.from(await workbook.xlsx.writeBuffer());
  }

  async exportMaintenanceCost(
    query: ReportQuery,
    user: AuthUser,
  ): Promise<Buffer> {
    const report = await this.maintenanceCostReport(query, user);
    const rows: any[] = (report.data as any).byMonth || [];
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet('Chi phí bảo trì theo tháng');
    sheet.columns = [
      { header: 'Năm', key: 'year', width: 8 },
      { header: 'Tháng', key: 'month', width: 8 },
      { header: 'Linh kiện', key: 'partsCost', width: 16 },
      { header: 'Nhân công', key: 'laborCost', width: 16 },
      { header: 'Thuê ngoài', key: 'externalCost', width: 16 },
      { header: 'Tổng', key: 'totalCost', width: 18 },
      { header: 'Số phiếu', key: 'count', width: 10 },
    ];
    rows.forEach((r: any) =>
      sheet.addRow({
        year: r._id?.year,
        month: r._id?.month,
        partsCost: r.partsCost,
        laborCost: r.laborCost,
        externalCost: r.externalCost,
        totalCost: r.totalCost,
        count: r.count,
      }),
    );
    this.styleSheet(sheet);
    for (const k of ['partsCost', 'laborCost', 'externalCost', 'totalCost']) {
      sheet.getColumn(k).numFmt = '#,##0';
    }
    return Buffer.from(await workbook.xlsx.writeBuffer());
  }

  async exportItPerformance(
    query: ReportQuery,
    user: AuthUser,
  ): Promise<Buffer> {
    const report = await this.itPerformanceReport(query, user);
    const techs: any[] = (report.data as any).byTechnician || [];
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet('Hiệu suất IT');
    sheet.columns = [
      { header: 'Mã NV', key: 'code', width: 12 },
      { header: 'Họ tên', key: 'name', width: 24 },
      { header: 'Tổng sự cố', key: 'total', width: 14 },
      { header: 'Đã xử lý', key: 'resolved', width: 14 },
      { header: 'Đánh giá TB', key: 'avgRating', width: 14 },
      { header: 'TG phản hồi TB (giờ)', key: 'avgResponseHours', width: 20 },
    ];
    techs.forEach((t: any) =>
      sheet.addRow({
        code: t.user?.employeeCode,
        name: t.user?.fullName,
        total: t.total,
        resolved: t.resolved,
        avgRating: t.avgRating,
        avgResponseHours: t.avgResponseHours,
      }),
    );
    this.styleSheet(sheet);
    return Buffer.from(await workbook.xlsx.writeBuffer());
  }

  /* ===================== Helpers ===================== */

  private ticketScopeForReport(user: AuthUser): Record<string, any> {
    if (hasPermission(user, PERMISSIONS.REPORT_VIEW_ALL)) return {};
    if (
      hasPermission(user, PERMISSIONS.REPORT_VIEW_DEPARTMENT) &&
      user.departmentId
    ) {
      return { departmentId: new Types.ObjectId(user.departmentId) };
    }
    return { reportedBy: new Types.ObjectId(user.id) };
  }

  private buildTicketScope(user: AuthUser): Record<string, any> {
    if (hasPermission(user, PERMISSIONS.REPORT_VIEW_ALL)) return {};
    if (
      hasPermission(user, PERMISSIONS.REPORT_VIEW_DEPARTMENT) &&
      user.departmentId
    ) {
      return { departmentId: new Types.ObjectId(user.departmentId) };
    }
    return { reportedBy: new Types.ObjectId(user.id) };
  }

  private async warrantyStats(scope: Record<string, any>, now: Date) {
    const base: Record<string, any> = { isActive: true, ...scope };
    const [valid, expiringSoon, expired, none] = await Promise.all([
      this.assetModel.countDocuments({
        ...base,
        warrantyEndDate: { $gt: now },
      }),
      this.assetModel.countDocuments({
        ...base,
        warrantyEndDate: { $gte: now, $lte: addDays(now, 30) },
      }),
      this.assetModel.countDocuments({
        ...base,
        warrantyEndDate: { $lt: now },
      }),
      this.assetModel.countDocuments({
        ...base,
        warrantyEndDate: null,
      }),
    ]);
    return { valid, expiringSoon, expired, none };
  }

  private async assetAgeBreakdown(match: Record<string, any>) {
    const buckets = await this.assetModel.aggregate([
      { $match: match },
      {
        $project: {
          age: {
            $cond: [
              { $ifNull: ['$purchaseDate', false] },
              {
                $divide: [
                  { $subtract: [new Date(), '$purchaseDate'] },
                  1000 * 60 * 60 * 24 * 365,
                ],
              },
              null,
            ],
          },
        },
      },
      {
        $bucket: {
          groupBy: '$age',
          boundaries: [0, 1, 3, 5, 7, 100],
          default: 'unknown',
          output: { count: { $sum: 1 } },
        },
      },
    ]);
    return buckets.map((b) => ({
      range:
        b._id === 0
          ? '<1 năm'
          : b._id === 1
            ? '1-3 năm'
            : b._id === 3
              ? '3-5 năm'
              : b._id === 5
                ? '5-7 năm'
                : b._id === 7
                  ? '>7 năm'
                  : 'Không xác định',
      count: b.count,
    }));
  }

  private async lookupStatusMap(ids: any[]) {
    if (!ids.length) return {};
    const arr = await this.statusModel
      .find({ _id: { $in: ids.filter(Boolean) } })
      .select('code name color')
      .lean();
    return Object.fromEntries(
      arr.map((s: any) => [
        String(s._id),
        { code: s.code, name: s.name, color: s.color },
      ]),
    );
  }

  private async lookupCategoryMap(ids: any[]) {
    if (!ids.length) return {};
    const arr = await this.categoryModel
      .find({ _id: { $in: ids.filter(Boolean) } })
      .select('code name codePrefix')
      .lean();
    return Object.fromEntries(
      arr.map((c: any) => [
        String(c._id),
        { code: c.code, name: c.name, codePrefix: c.codePrefix },
      ]),
    );
  }

  private async lookupDepartmentMap(ids: any[]) {
    if (!ids.length) return {};
    const arr = await this.departmentModel
      .find({ _id: { $in: ids.filter(Boolean) } })
      .select('code name')
      .lean();
    return Object.fromEntries(
      arr.map((d: any) => [String(d._id), { code: d.code, name: d.name }]),
    );
  }

  private styleSheet(sheet: ExcelJS.Worksheet) {
    sheet.getRow(1).font = { bold: true };
    sheet.getRow(1).fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFE2E8F0' },
    };
  }
}

import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { PERMISSIONS } from '../../common/constants/permissions.constant';
import { RefType, SettingKey } from '../../common/constants/system-codes';
import { CounterService } from '../../common/counters/counter.service';
import { addDays } from '../../common/utils/paginate.util';
import { createApiResponse } from '../../common/utils/response.util';
import { AssetsService } from '../assets/assets.service';
import { Asset } from '../assets/schemas/asset.schema';
import { AssetStatusesService } from '../catalogs/services/asset-statuses.service';
import { SettingsService } from '../catalogs/services/settings.service';
import { SparePartsService } from '../spare-parts/spare-parts.service';
import { MaintenancePlansService } from '../maintenance/maintenance-plans.service';
import {
  MaintenanceTask,
  MaintenanceTaskStatus,
  MaintenanceType,
} from '../maintenance/schemas/maintenance.schemas';
import { NotificationType } from '../notifications/schemas/notification.schema';
import { NotificationsService } from '../notifications/notifications.service';
import { OPEN_TICKET_STATUSES, Ticket } from '../tickets/schemas/ticket.schema';
import { AlertLog, AlertType } from './alert-log.schema';

export interface AlertRunResult {
  job: string;
  notified: number;
  duration: number;
}

@Injectable()
export class AlertsService {
  private readonly logger = new Logger(AlertsService.name);

  constructor(
    @InjectModel(AlertLog.name) private readonly alertLogModel: Model<AlertLog>,
    @InjectModel(Asset.name) private readonly assetModel: Model<Asset>,
    @InjectModel(Ticket.name) private readonly ticketModel: Model<Ticket>,
    @InjectModel(MaintenanceTask.name)
    private readonly taskModel: Model<MaintenanceTask>,
    private readonly assetsService: AssetsService,
    private readonly sparePartsService: SparePartsService,
    private readonly settingsService: SettingsService,
    private readonly statusesService: AssetStatusesService,
    private readonly notificationsService: NotificationsService,
    private readonly plansService: MaintenancePlansService,
    private readonly counterService: CounterService,
  ) {}

  /* ===================== Cron jobs ===================== */

  /** 07:00 mỗi ngày: cảnh báo bảo hành */
  @Cron('0 7 * * *', { timeZone: 'Asia/Ho_Chi_Minh' })
  async cronWarranty() {
    return this.runWarrantyAlerts();
  }

  /** 00:30 mỗi ngày: sinh phiếu bảo trì + cảnh báo quá hạn */
  @Cron('30 0 * * *', { timeZone: 'Asia/Ho_Chi_Minh' })
  async cronMaintenance() {
    await this.runMaintenanceTasks();
    await this.runMaintenanceOverdue();
  }

  /** 07:30 mỗi ngày: cảnh báo tồn kho thấp */
  @Cron('30 7 * * *', { timeZone: 'Asia/Ho_Chi_Minh' })
  async cronLowStock() {
    return this.runLowStockAlerts();
  }

  /** Mỗi giờ: sự cố quá hạn SLA */
  @Cron(CronExpression.EVERY_HOUR, { timeZone: 'Asia/Ho_Chi_Minh' })
  async cronTicketOverdue() {
    return this.runTicketOverdue();
  }

  /* ===================== Manual trigger ===================== */

  async runJob(job: string): Promise<AlertRunResult> {
    const start = Date.now();
    let notified = 0;
    switch (job) {
      case 'warranty':
        notified = await this.runWarrantyAlerts();
        break;
      case 'maintenance':
        notified = await this.runMaintenanceTasks();
        break;
      case 'maintenance-overdue':
        notified = await this.runMaintenanceOverdue();
        break;
      case 'low-stock':
        notified = await this.runLowStockAlerts();
        break;
      case 'ticket-overdue':
        notified = await this.runTicketOverdue();
        break;
      default:
        throw new Error(`Không hỗ trợ job: ${job}`);
    }
    return { job, notified, duration: Date.now() - start };
  }

  async runAll(): Promise<AlertRunResult[]> {
    return Promise.all(
      [
        'warranty',
        'maintenance',
        'maintenance-overdue',
        'low-stock',
        'ticket-overdue',
      ].map((job) => this.runJob(job)),
    );
  }

  /* ===================== Triển khai từng job ===================== */

  /** Cảnh báo bảo hành sắp hết / đã hết */
  async runWarrantyAlerts(): Promise<number> {
    const days = await this.settingsService.get<number>(
      SettingKey.WARRANTY_ALERT_DAYS,
    );
    const now = new Date();
    const soon = addDays(now, days);
    const assets = await this.assetModel
      .find({
        isActive: true,
        warrantyEndDate: { $lte: soon },
      })
      .select('_id assetCode name warrantyEndDate')
      .lean();
    let count = 0;
    for (const a of assets) {
      if (!a.warrantyEndDate) continue;
      const dateStr = a.warrantyEndDate.toISOString().slice(0, 10);
      const dedupeKey = `WARRANTY:${a._id}:${dateStr}`;
      if (await this.isAlreadyNotified(dedupeKey)) continue;
      const isExpired = a.warrantyEndDate < now;
      await this.notificationsService.notifyPermission(
        PERMISSIONS.ASSET_READ_ALL,
        {
          type: NotificationType.WARRANTY_EXPIRING,
          title: isExpired
            ? `Tài sản ${a.assetCode} đã hết bảo hành`
            : `Tài sản ${a.assetCode} sắp hết bảo hành (còn ${days} ngày)`,
          content: `${a.name} — hết hạn ${dateStr}`,
          refType: RefType.ASSET,
          refId: a._id,
        },
      );
      await this.logAlert(dedupeKey, AlertType.WARRANTY_EXPIRING, a._id);
      count++;
    }
    if (count) this.logger.log(`Đã cảnh báo bảo hành cho ${count} tài sản`);
    return count;
  }

  /** Sinh phiếu bảo trì cho các kế hoạch đến hạn */
  async runMaintenanceTasks(): Promise<number> {
    const plans = await this.plansService.findDuePlans(new Date());
    let count = 0;
    for (const plan of plans) {
      const assets = await this.plansService.findScopeAssets(plan, '_id');
      for (const asset of assets) {
        const dedupeKey = `MAINT:${plan._id}:${asset._id}:${plan.nextRunDate.toISOString().slice(0, 10)}`;
        if (await this.isAlreadyNotified(dedupeKey)) continue;
        const code = await this.counterService.nextCode('BT', {
          period: 'MONTH',
        });
        const assetId = (asset as any)._id as Types.ObjectId;
        const departmentId = (asset as any).departmentId as Types.ObjectId;
        const task = await this.taskModel.create({
          code,
          type: MaintenanceType.PREVENTIVE,
          planId: plan._id,
          assetId,
          departmentId,
          title: `Bảo trì định kỳ theo KH ${plan.code}`,
          scheduledDate: plan.nextRunDate,
          assigneeId: plan.defaultAssigneeId,
          checklist: plan.checklist,
          status: MaintenanceTaskStatus.SCHEDULED,
        });
        if (task.assigneeId) {
          await this.notificationsService.notifyUsers([task.assigneeId], {
            type: NotificationType.MAINTENANCE_ASSIGNED,
            title: `Bạn được phân công phiếu bảo trì ${task.code}`,
            content: `Theo kế hoạch ${plan.code}`,
            refType: RefType.MAINTENANCE_TASK,
            refId: task._id,
          });
        }
        await this.logAlert(dedupeKey, AlertType.MAINTENANCE_DUE, task._id);
        count++;
      }
    }
    if (count)
      this.logger.log(`Đã sinh ${count} phiếu bảo trì từ kế hoạch đến hạn`);
    return count;
  }

  /** Đánh dấu task quá hạn + thông báo */
  async runMaintenanceOverdue(): Promise<number> {
    const now = new Date();
    const overdue = await this.taskModel.find({
      isActive: true,
      status: { $in: [MaintenanceTaskStatus.SCHEDULED] },
      scheduledDate: { $lt: now },
    });
    let count = 0;
    for (const task of overdue) {
      const dedupeKey = `MAINT_OVERDUE:${task._id}:${now.toISOString().slice(0, 10)}`;
      if (await this.isAlreadyNotified(dedupeKey)) continue;
      task.status = MaintenanceTaskStatus.OVERDUE;
      await task.save();
      await this.notificationsService.notifyUsers(
        [task.assigneeId].filter(Boolean) as any,
        {
          type: NotificationType.MAINTENANCE_OVERDUE,
          title: `Phiếu bảo trì ${task.code} đã quá hạn`,
          refType: RefType.MAINTENANCE_TASK,
          refId: task._id,
        },
      );
      await this.notificationsService.notifyPermission(
        PERMISSIONS.MAINTENANCE_READ_ALL,
        {
          type: NotificationType.MAINTENANCE_OVERDUE,
          title: `Phiếu bảo trì ${task.code} quá hạn`,
          content: `Tài sản đến hạn từ ${task.scheduledDate.toISOString().slice(0, 10)}`,
          refType: RefType.MAINTENANCE_TASK,
          refId: task._id,
        },
      );
      await this.logAlert(dedupeKey, AlertType.MAINTENANCE_OVERDUE, task._id);
      count++;
    }
    if (count) this.logger.log(`Đã đánh dấu ${count} phiếu bảo trì quá hạn`);
    return count;
  }

  /** Cảnh báo tồn kho thấp */
  async runLowStockAlerts(): Promise<number> {
    const parts = await this.sparePartsService
      .findLowStock()
      .then((r) => r.data as any[]);
    let count = 0;
    const now = new Date().toISOString().slice(0, 10);
    for (const p of parts) {
      const dedupeKey = `LOW_STOCK:${p._id}:${now}`;
      if (await this.isAlreadyNotified(dedupeKey)) continue;
      await this.notificationsService.notifyPermission(
        PERMISSIONS.SPARE_PART_MANAGE,
        {
          type: NotificationType.LOW_STOCK,
          title: `Linh kiện ${p.code} tồn thấp (${p.quantity} ${p.unit})`,
          content: `${p.name} — ngưỡng tối thiểu ${p.minQuantity}`,
          refType: RefType.SPARE_PART,
          refId: p._id,
        },
      );
      await this.logAlert(dedupeKey, AlertType.LOW_STOCK, p._id);
      count++;
    }
    if (count) this.logger.log(`Đã cảnh báo tồn thấp cho ${count} linh kiện`);
    return count;
  }

  /** Cảnh báo sự cố quá hạn SLA */
  async runTicketOverdue(): Promise<number> {
    const now = new Date();
    const tickets = await this.ticketModel
      .find({
        isActive: true,
        status: { $in: OPEN_TICKET_STATUSES },
        dueAt: { $lt: now },
      })
      .select('_id code title dueAt assigneeId')
      .lean();
    let count = 0;
    for (const t of tickets) {
      if (!t.dueAt) continue;
      const dedupeKey = `TICKET_OVERDUE:${t._id}:${t.dueAt.toISOString().slice(0, 10)}`;
      if (await this.isAlreadyNotified(dedupeKey)) continue;
      const ids = [t.assigneeId].filter(Boolean) as any[];
      if (ids.length) {
        await this.notificationsService.notifyUsers(ids, {
          type: NotificationType.TICKET_OVERDUE,
          title: `Sự cố ${t.code} đã quá hạn SLA`,
          content: t.title,
          refType: RefType.TICKET,
          refId: t._id,
        });
      }
      await this.notificationsService.notifyPermission(
        PERMISSIONS.TICKET_READ_ALL,
        {
          type: NotificationType.TICKET_OVERDUE,
          title: `Sự cố ${t.code} quá hạn chưa xử lý`,
          refType: RefType.TICKET,
          refId: t._id,
        },
      );
      await this.logAlert(dedupeKey, AlertType.TICKET_OVERDUE, t._id);
      count++;
    }
    if (count) this.logger.log(`Đã cảnh báo ${count} sự cố quá hạn`);
    return count;
  }

  /* ===================== Helpers ===================== */

  private async isAlreadyNotified(dedupeKey: string) {
    return (await this.alertLogModel.exists({ dedupeKey })) !== null;
  }

  private async logAlert(dedupeKey: string, type: AlertType, refId: any) {
    await this.alertLogModel.updateOne(
      { dedupeKey },
      {
        $set: { type, refId, sentAt: new Date() },
        $inc: { notified: 1 },
      },
      { upsert: true },
    );
  }

  async listLogs(type?: string, limit = 50) {
    const filter: Record<string, any> = {};
    if (type) filter.type = type;
    return createApiResponse(
      await this.alertLogModel
        .find(filter)
        .sort({ sentAt: -1 })
        .limit(limit)
        .lean(),
      'Lấy lịch sử cảnh báo thành công',
    );
  }
}

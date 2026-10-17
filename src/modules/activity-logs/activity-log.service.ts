import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { applyDateRange, paginate } from '../../common/utils/paginate.util';
import { buildSearchFilter } from '../../common/utils/regex.util';
import { ActivityLogQueryDto } from './activity-log.dto';
import { ActivityLog } from './activity-log.schema';

@Injectable()
export class ActivityLogService {
  private readonly logger = new Logger(ActivityLogService.name);

  constructor(
    @InjectModel(ActivityLog.name)
    private readonly activityLogModel: Model<ActivityLog>,
  ) {}

  async log(data: Partial<ActivityLog>): Promise<void> {
    try {
      await this.activityLogModel.create(data);
    } catch (error) {
      this.logger.warn(`Không ghi được activity log: ${error.message}`);
    }
  }

  async findAll(query: ActivityLogQueryDto) {
    const filter: Record<string, any> = {
      ...buildSearchFilter(query.search, ['description', 'username', 'url']),
    };
    if (query.userId) filter.userId = query.userId;
    if (query.module) filter.module = query.module;
    if (query.action) filter.action = query.action;
    if (query.status) filter.status = query.status;
    applyDateRange(filter, 'createdAt', query.fromDate, query.toDate);

    return paginate(this.activityLogModel, filter, query, {
      message: 'Lấy nhật ký hoạt động thành công',
    });
  }
}

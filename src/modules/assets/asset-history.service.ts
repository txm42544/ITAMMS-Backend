import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { paginate } from '../../common/utils/paginate.util';
import { AssetHistoryQueryDto } from './dto/asset.dto';
import {
  AssetHistory,
  AssetHistoryAction,
} from './schemas/asset-history.schema';

export type AssetHistoryEntry = Partial<
  Pick<
    AssetHistory,
    | 'description'
    | 'fromUserId'
    | 'toUserId'
    | 'fromDepartmentId'
    | 'toDepartmentId'
    | 'fromLocationId'
    | 'toLocationId'
    | 'fromStatusId'
    | 'toStatusId'
    | 'refType'
    | 'refId'
    | 'cost'
    | 'changes'
  >
> & {
  assetId: any;
  action: AssetHistoryAction;
  performedBy?: any;
};

const HISTORY_POPULATE = [
  { path: 'fromUserId', select: 'employeeCode fullName' },
  { path: 'toUserId', select: 'employeeCode fullName' },
  { path: 'fromDepartmentId', select: 'code name' },
  { path: 'toDepartmentId', select: 'code name' },
  { path: 'fromLocationId', select: 'code name' },
  { path: 'toLocationId', select: 'code name' },
  { path: 'fromStatusId', select: 'code name color' },
  { path: 'toStatusId', select: 'code name color' },
  { path: 'performedBy', select: 'employeeCode fullName' },
];

@Injectable()
export class AssetHistoryService {
  constructor(
    @InjectModel(AssetHistory.name)
    private readonly historyModel: Model<AssetHistory>,
  ) {}

  log(entry: AssetHistoryEntry) {
    return this.historyModel.create(entry);
  }

  logMany(entries: AssetHistoryEntry[]) {
    return this.historyModel.insertMany(entries);
  }

  findByAsset(assetId: string, query: AssetHistoryQueryDto) {
    const filter: Record<string, any> = { assetId };
    if (query.actions) {
      filter.action = { $in: query.actions.split(',').map((a) => a.trim()) };
    }
    return paginate(this.historyModel, filter, query, {
      populate: HISTORY_POPULATE,
      message: 'Lấy lịch sử tài sản thành công',
    });
  }

  findRecent(assetId: any, limit = 5) {
    return this.historyModel
      .find({ assetId })
      .sort({ createdAt: -1 })
      .limit(limit)
      .populate(HISTORY_POPULATE)
      .lean();
  }
}

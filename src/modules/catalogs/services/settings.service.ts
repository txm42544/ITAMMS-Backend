import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { SettingKey } from '../../../common/constants/system-codes';
import { createApiResponse } from '../../../common/utils/response.util';
import { UpdateSettingsDto } from '../dto/catalog.dto';
import { Setting } from '../schemas/catalog.schemas';

/** Giá trị mặc định của các cấu hình hệ thống */
export const DEFAULT_SETTINGS: {
  key: SettingKey;
  value: any;
  type: 'number' | 'string' | 'boolean';
  description: string;
}[] = [
  {
    key: SettingKey.WARRANTY_ALERT_DAYS,
    value: 30,
    type: 'number',
    description: 'Cảnh báo trước khi hết hạn bảo hành (ngày)',
  },
  {
    key: SettingKey.MAINTENANCE_LEAD_DAYS,
    value: 7,
    type: 'number',
    description: 'Tạo phiếu bảo trì trước ngày đến hạn (ngày)',
  },
  {
    key: SettingKey.TICKET_SLA_DEFAULT_HOURS,
    value: 24,
    type: 'number',
    description: 'Thời hạn xử lý sự cố mặc định khi chưa phân loại (giờ)',
  },
  {
    key: SettingKey.TICKET_AUTO_CLOSE_DAYS,
    value: 3,
    type: 'number',
    description: 'Tự động nghiệm thu sự cố đã xử lý sau số ngày (0 = tắt)',
  },
];

@Injectable()
export class SettingsService {
  constructor(
    @InjectModel(Setting.name) private readonly settingModel: Model<Setting>,
  ) {}

  async findAll() {
    const data = await this.settingModel
      .find()
      .select('key value type description updatedAt')
      .sort({ key: 1 })
      .lean();
    return createApiResponse(data, 'Lấy cấu hình hệ thống thành công');
  }

  async updateMany(dto: UpdateSettingsDto, userId: string) {
    for (const item of dto.items) {
      const def = DEFAULT_SETTINGS.find((s) => s.key === item.key);
      if (!def) {
        throw new BadRequestException(`Cấu hình không tồn tại: ${item.key}`);
      }
      const value = this.cast(item.value, def.type, item.key);
      await this.settingModel.updateOne(
        { key: item.key },
        {
          $set: { value, updatedBy: userId },
          $setOnInsert: { type: def.type, description: def.description },
        },
        { upsert: true },
      );
    }
    return this.findAll().then((r) => ({
      ...r,
      message: 'Cập nhật cấu hình thành công',
    }));
  }

  /** Đọc 1 cấu hình (fallback về giá trị mặc định) */
  async get<T = any>(key: SettingKey): Promise<T> {
    const setting = await this.settingModel.findOne({ key }).lean();
    if (setting && setting.value !== undefined && setting.value !== null) {
      return setting.value as T;
    }
    return DEFAULT_SETTINGS.find((s) => s.key === key)?.value as T;
  }

  private cast(value: any, type: string, key: string) {
    if (type === 'number') {
      const n = Number(value);
      if (!Number.isFinite(n) || n < 0) {
        throw new BadRequestException(`Giá trị của ${key} phải là số >= 0`);
      }
      return n;
    }
    if (type === 'boolean') return value === true || value === 'true';
    return String(value);
  }
}

import {
  ForbiddenException,
  Injectable,
  InternalServerErrorException,
} from '@nestjs/common';
import { InjectConnection, InjectModel } from '@nestjs/mongoose';
import { Connection, Model, Types } from 'mongoose';
import { SystemAssetStatus } from '../../../common/constants/system-codes';
import { BaseCrudService } from '../../../common/services/base-crud.service';
import { ensureNotReferenced } from '../../../common/utils/reference.util';
import { CreateAssetStatusDto, UpdateAssetStatusDto } from '../dto/catalog.dto';
import { AssetStatus } from '../schemas/catalog.schemas';

@Injectable()
export class AssetStatusesService extends BaseCrudService<AssetStatus> {
  /** Cache code → status (trạng thái hệ thống được dùng liên tục trong nghiệp vụ) */
  private cache = new Map<string, AssetStatus>();

  constructor(
    @InjectModel(AssetStatus.name) model: Model<AssetStatus>,
    @InjectConnection() private readonly connection: Connection,
  ) {
    super(model, {
      entityName: 'trạng thái thiết bị',
      searchFields: ['code', 'name'],
      uniqueFields: ['code'],
      defaultSort: { order: 1 },
      optionFields: 'code name color order isSystem allowAssign isFinal',
    });
  }

  create(dto: CreateAssetStatusDto, userId: string) {
    this.cache.clear();
    return super.create(
      { ...dto, code: dto.code.toUpperCase(), isSystem: false, isFinal: false },
      userId,
    );
  }

  async update(id: string, dto: UpdateAssetStatusDto, userId: string) {
    const status = await this.findEntity(id);
    if (status.isSystem && dto.code && dto.code.toUpperCase() !== status.code) {
      throw new ForbiddenException('Không thể đổi mã trạng thái hệ thống');
    }
    this.cache.clear();
    return super.update(
      id,
      dto.code ? { ...dto, code: dto.code.toUpperCase() } : dto,
      userId,
    );
  }

  protected async beforeRemove(entity: AssetStatus) {
    if (entity.isSystem) {
      throw new ForbiddenException('Không thể xoá trạng thái hệ thống');
    }
    await ensureNotReferenced(this.connection, entity._id, [
      { model: 'Asset', field: 'statusId', label: 'tài sản' },
    ]);
    this.cache.clear();
  }

  async getByCode(code: SystemAssetStatus | string): Promise<AssetStatus> {
    if (!this.cache.has(code)) {
      const status = await this.model.findOne({ code, isActive: true });
      if (!status) {
        throw new InternalServerErrorException(
          `Thiếu trạng thái hệ thống ${code} — hãy chạy seed`,
        );
      }
      this.cache.set(code, status);
    }
    return this.cache.get(code);
  }

  async getIdByCode(code: SystemAssetStatus | string): Promise<Types.ObjectId> {
    return (await this.getByCode(code))._id as Types.ObjectId;
  }

  /** Tìm ID theo mã bất kỳ (trả null nếu không có) — dùng cho bộ lọc */
  async findIdByCode(code: string): Promise<Types.ObjectId | null> {
    const status = await this.model
      .findOne({ code: code.toUpperCase(), isActive: true })
      .select('_id')
      .lean();
    return (status?._id as Types.ObjectId) ?? null;
  }
}

import {
  ConflictException,
  HttpStatus,
  NotFoundException,
} from '@nestjs/common';
import { Model, PopulateOptions, SortOrder } from 'mongoose';
import { PaginationQueryDto } from '../dto/pagination-query.dto';
import { BaseEntity } from '../schemas/base.schema';
import { paginate } from '../utils/paginate.util';
import { buildSearchFilter } from '../utils/regex.util';
import { ApiResponseType, createApiResponse } from '../utils/response.util';

export interface CrudOptions {
  /** Tên hiển thị trong message, vd: 'phòng ban' */
  entityName: string;
  searchFields: string[];
  /** Các trường phải duy nhất trong số bản ghi còn hoạt động */
  uniqueFields?: string[];
  populate?: string | PopulateOptions | (string | PopulateOptions)[];
  defaultSort?: Record<string, SortOrder>;
  /** Trường trả về cho API dropdown /options */
  optionFields?: string;
}

/**
 * CRUD chuẩn cho các danh mục (soft delete bằng isActive).
 * Service con override `buildFilter` để thêm bộ lọc và `beforeRemove` để kiểm tra ràng buộc.
 */
export abstract class BaseCrudService<T extends BaseEntity> {
  protected constructor(
    protected readonly model: Model<T>,
    protected readonly options: CrudOptions,
  ) {}

  protected buildFilter(_query: any): Record<string, any> {
    return {};
  }

  protected async beforeRemove(_entity: T): Promise<void> {
    return;
  }

  async create(
    dto: Record<string, any>,
    userId: string,
  ): Promise<ApiResponseType<any>> {
    await this.ensureUnique(dto);
    const doc = await this.model.create({ ...dto, createdBy: userId });
    return createApiResponse(
      doc,
      `Thêm ${this.options.entityName} thành công`,
      HttpStatus.CREATED,
    );
  }

  async findAll(query: PaginationQueryDto & Record<string, any>) {
    const filter = {
      isActive: true,
      ...this.buildFilter(query),
      ...buildSearchFilter(query.search, this.options.searchFields),
    };
    return paginate(this.model, filter, query, {
      populate: this.options.populate,
      defaultSort: this.options.defaultSort,
      message: `Lấy danh sách ${this.options.entityName} thành công`,
    });
  }

  /** Danh sách rút gọn cho dropdown (không phân trang) */
  async findOptions() {
    const data = await this.model
      .find({ isActive: true } as any)
      .select(this.options.optionFields || 'code name')
      .sort(this.options.defaultSort || { name: 1 })
      .lean();
    return createApiResponse(data, 'Thành công');
  }

  async findOne(id: string): Promise<ApiResponseType<any>> {
    const entity = await this.findEntity(id, true);
    return createApiResponse(entity, 'Thành công');
  }

  async findEntity(id: string, populate = false): Promise<T> {
    let q = this.model.findOne({ _id: id, isActive: true } as any);
    if (populate && this.options.populate) {
      q = q.populate(this.options.populate as any);
    }
    const entity = await q.exec();
    if (!entity) {
      throw new NotFoundException(`Không tìm thấy ${this.options.entityName}`);
    }
    return entity as T;
  }

  async update(
    id: string,
    dto: Record<string, any>,
    userId: string,
  ): Promise<ApiResponseType<any>> {
    await this.ensureUnique(dto, id);
    const entity = await this.model.findOneAndUpdate(
      { _id: id, isActive: true } as any,
      { ...dto, updatedBy: userId },
      { new: true },
    );
    if (!entity) {
      throw new NotFoundException(`Không tìm thấy ${this.options.entityName}`);
    }
    return createApiResponse(
      entity,
      `Cập nhật ${this.options.entityName} thành công`,
    );
  }

  async remove(id: string, userId: string): Promise<ApiResponseType<any>> {
    const entity = await this.findEntity(id);
    await this.beforeRemove(entity);
    entity.isActive = false;
    entity.updatedBy = userId as any;
    await entity.save();
    return createApiResponse(null, `Xoá ${this.options.entityName} thành công`);
  }

  protected async ensureUnique(dto: Record<string, any>, excludeId?: string) {
    for (const field of this.options.uniqueFields || []) {
      if (dto[field] === undefined || dto[field] === null) continue;
      const filter: any = { [field]: dto[field], isActive: true };
      if (excludeId) filter._id = { $ne: excludeId };
      if (await this.model.exists(filter)) {
        throw new ConflictException(`${field} "${dto[field]}" đã tồn tại`);
      }
    }
  }
}

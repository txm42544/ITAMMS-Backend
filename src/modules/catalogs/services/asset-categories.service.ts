import { Injectable } from '@nestjs/common';
import { InjectConnection, InjectModel } from '@nestjs/mongoose';
import { Connection, Model } from 'mongoose';
import { BaseCrudService } from '../../../common/services/base-crud.service';
import { ensureNotReferenced } from '../../../common/utils/reference.util';
import {
  CreateAssetCategoryDto,
  UpdateAssetCategoryDto,
} from '../dto/catalog.dto';
import { AssetCategory } from '../schemas/catalog.schemas';

@Injectable()
export class AssetCategoriesService extends BaseCrudService<AssetCategory> {
  constructor(
    @InjectModel(AssetCategory.name) model: Model<AssetCategory>,
    @InjectConnection() private readonly connection: Connection,
  ) {
    super(model, {
      entityName: 'loại thiết bị',
      searchFields: ['code', 'name', 'codePrefix'],
      uniqueFields: ['code', 'codePrefix'],
      defaultSort: { name: 1 },
      optionFields:
        'code name codePrefix specFields defaultMaintenanceCycleMonths',
    });
  }

  create(dto: CreateAssetCategoryDto, userId: string) {
    return super.create(this.normalize(dto), userId);
  }

  update(id: string, dto: UpdateAssetCategoryDto, userId: string) {
    return super.update(id, this.normalize(dto), userId);
  }

  protected async beforeRemove(entity: AssetCategory) {
    await ensureNotReferenced(this.connection, entity._id, [
      { model: 'Asset', field: 'categoryId', label: 'tài sản' },
    ]);
  }

  private normalize<T extends Partial<CreateAssetCategoryDto>>(dto: T): T {
    return {
      ...dto,
      ...(dto.code && { code: dto.code.toUpperCase() }),
      ...(dto.codePrefix && { codePrefix: dto.codePrefix.toUpperCase() }),
    };
  }
}

import { Injectable } from '@nestjs/common';
import { InjectConnection, InjectModel } from '@nestjs/mongoose';
import { Connection, Model } from 'mongoose';
import { BaseCrudService } from '../../../common/services/base-crud.service';
import { ensureNotReferenced } from '../../../common/utils/reference.util';
import {
  CreateLocationDto,
  LocationQueryDto,
  UpdateLocationDto,
} from '../dto/catalog.dto';
import { Location } from '../schemas/catalog.schemas';

@Injectable()
export class LocationsService extends BaseCrudService<Location> {
  constructor(
    @InjectModel(Location.name) model: Model<Location>,
    @InjectConnection() private readonly connection: Connection,
  ) {
    super(model, {
      entityName: 'vị trí',
      searchFields: ['code', 'name', 'building', 'room'],
      uniqueFields: ['code'],
      populate: { path: 'departmentId', select: 'code name' },
      defaultSort: { code: 1 },
      optionFields: 'code name building floor room departmentId',
    });
  }

  protected buildFilter(query: LocationQueryDto) {
    return query.departmentId ? { departmentId: query.departmentId } : {};
  }

  create(dto: CreateLocationDto, userId: string) {
    return super.create({ ...dto, code: dto.code.toUpperCase() }, userId);
  }

  update(id: string, dto: UpdateLocationDto, userId: string) {
    return super.update(
      id,
      dto.code ? { ...dto, code: dto.code.toUpperCase() } : dto,
      userId,
    );
  }

  protected async beforeRemove(entity: Location) {
    await ensureNotReferenced(this.connection, entity._id, [
      { model: 'Asset', field: 'locationId', label: 'tài sản' },
    ]);
  }
}

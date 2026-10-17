import { Injectable } from '@nestjs/common';
import { InjectConnection, InjectModel } from '@nestjs/mongoose';
import { Connection, Model } from 'mongoose';
import { BaseCrudService } from '../../../common/services/base-crud.service';
import { ensureNotReferenced } from '../../../common/utils/reference.util';
import {
  CreateIncidentTypeDto,
  UpdateIncidentTypeDto,
} from '../dto/catalog.dto';
import { IncidentType } from '../schemas/catalog.schemas';

@Injectable()
export class IncidentTypesService extends BaseCrudService<IncidentType> {
  constructor(
    @InjectModel(IncidentType.name) model: Model<IncidentType>,
    @InjectConnection() private readonly connection: Connection,
  ) {
    super(model, {
      entityName: 'loại sự cố',
      searchFields: ['code', 'name'],
      uniqueFields: ['code'],
      defaultSort: { name: 1 },
      optionFields: 'code name defaultPriority slaHours',
    });
  }

  create(dto: CreateIncidentTypeDto, userId: string) {
    return super.create({ ...dto, code: dto.code.toUpperCase() }, userId);
  }

  update(id: string, dto: UpdateIncidentTypeDto, userId: string) {
    return super.update(
      id,
      dto.code ? { ...dto, code: dto.code.toUpperCase() } : dto,
      userId,
    );
  }

  protected async beforeRemove(entity: IncidentType) {
    await ensureNotReferenced(this.connection, entity._id, [
      {
        model: 'Ticket',
        field: 'incidentTypeId',
        label: 'sự cố chưa đóng',
        extra: { status: { $nin: ['CLOSED', 'CANCELLED'] } },
      },
    ]);
  }
}

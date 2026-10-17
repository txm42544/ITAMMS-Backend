import { Injectable } from '@nestjs/common';
import { InjectConnection, InjectModel } from '@nestjs/mongoose';
import { Connection, Model } from 'mongoose';
import { BaseCrudService } from '../../../common/services/base-crud.service';
import { ensureNotReferenced } from '../../../common/utils/reference.util';
import { CreateSupplierDto, UpdateSupplierDto } from '../dto/catalog.dto';
import { Supplier } from '../schemas/catalog.schemas';

@Injectable()
export class SuppliersService extends BaseCrudService<Supplier> {
  constructor(
    @InjectModel(Supplier.name) model: Model<Supplier>,
    @InjectConnection() private readonly connection: Connection,
  ) {
    super(model, {
      entityName: 'nhà cung cấp',
      searchFields: ['code', 'name', 'phone', 'email', 'taxCode'],
      uniqueFields: ['code'],
      defaultSort: { name: 1 },
    });
  }

  create(dto: CreateSupplierDto, userId: string) {
    return super.create({ ...dto, code: dto.code.toUpperCase() }, userId);
  }

  update(id: string, dto: UpdateSupplierDto, userId: string) {
    return super.update(
      id,
      dto.code ? { ...dto, code: dto.code.toUpperCase() } : dto,
      userId,
    );
  }

  protected async beforeRemove(entity: Supplier) {
    await ensureNotReferenced(this.connection, entity._id, [
      { model: 'Asset', field: 'supplierId', label: 'tài sản' },
      { model: 'SparePart', field: 'supplierId', label: 'linh kiện' },
    ]);
  }
}

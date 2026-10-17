import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectConnection, InjectModel } from '@nestjs/mongoose';
import { Connection, Model } from 'mongoose';
import { BaseCrudService } from '../../common/services/base-crud.service';
import { ensureNotReferenced } from '../../common/utils/reference.util';
import { UsersService } from '../users/users.service';
import {
  CreateDepartmentDto,
  DepartmentQueryDto,
  UpdateDepartmentDto,
} from './dto/department.dto';
import { Department } from './schemas/department.schema';

@Injectable()
export class DepartmentsService extends BaseCrudService<Department> {
  constructor(
    @InjectModel(Department.name) model: Model<Department>,
    @InjectConnection() private readonly connection: Connection,
    private readonly usersService: UsersService,
  ) {
    super(model, {
      entityName: 'phòng ban',
      searchFields: ['code', 'name'],
      uniqueFields: ['code'],
      populate: [
        { path: 'managerId', select: 'employeeCode fullName email phone' },
        { path: 'parentId', select: 'code name' },
      ],
      defaultSort: { code: 1 },
    });
  }

  protected buildFilter(query: DepartmentQueryDto) {
    return query.parentId ? { parentId: query.parentId } : {};
  }

  async create(dto: CreateDepartmentDto, userId: string) {
    await this.validateRefs(dto);
    return super.create({ ...dto, code: dto.code.toUpperCase() }, userId);
  }

  async update(id: string, dto: UpdateDepartmentDto, userId: string) {
    if (dto.parentId && dto.parentId === id) {
      throw new BadRequestException('Phòng ban cha không được là chính nó');
    }
    await this.validateRefs(dto);
    const data: any = { ...dto };
    if (data.code) data.code = data.code.toUpperCase();
    return super.update(id, data, userId);
  }

  protected async beforeRemove(entity: Department) {
    await ensureNotReferenced(this.connection, entity._id, [
      { model: 'User', field: 'departmentId', label: 'tài khoản' },
      { model: 'Asset', field: 'departmentId', label: 'tài sản' },
      { model: Department.name, field: 'parentId', label: 'phòng ban con' },
    ]);
  }

  private async validateRefs(dto: Partial<CreateDepartmentDto>) {
    if (dto.parentId) await this.findEntity(dto.parentId);
    if (dto.managerId) await this.usersService.getActiveUser(dto.managerId);
  }
}

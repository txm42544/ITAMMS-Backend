import {
  BadRequestException,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { InjectConnection, InjectModel } from '@nestjs/mongoose';
import { Connection, Model } from 'mongoose';
import {
  ALL_PERMISSION_CODES,
  ALL_PERMISSIONS,
} from '../../common/constants/permissions.constant';
import { SystemRole } from '../../common/constants/system-codes';
import { BaseCrudService } from '../../common/services/base-crud.service';
import { ensureNotReferenced } from '../../common/utils/reference.util';
import { CreateRoleDto, UpdateRoleDto } from './dto/role.dto';
import { Role } from './schemas/role.schema';

@Injectable()
export class RolesService extends BaseCrudService<Role> {
  constructor(
    @InjectModel(Role.name) roleModel: Model<Role>,
    @InjectConnection() private readonly connection: Connection,
  ) {
    super(roleModel, {
      entityName: 'vai trò',
      searchFields: ['code', 'name'],
      uniqueFields: ['code'],
      defaultSort: { isSystem: -1, createdAt: 1 },
      optionFields: 'code name isSystem',
    });
  }

  async create(dto: CreateRoleDto, userId: string) {
    this.validatePermissions(dto.permissions);
    return super.create(
      { ...dto, code: dto.code.toUpperCase(), isSystem: false },
      userId,
    );
  }

  async update(id: string, dto: UpdateRoleDto, userId: string) {
    const role = await this.findEntity(id);
    if (dto.permissions) this.validatePermissions(dto.permissions);

    if (role.isSystem) {
      if (dto.code && dto.code.toUpperCase() !== role.code) {
        throw new ForbiddenException('Không thể đổi mã của vai trò hệ thống');
      }
      if (role.code === SystemRole.ADMIN && dto.permissions) {
        throw new ForbiddenException(
          'Không thể thay đổi quyền của vai trò Quản trị viên',
        );
      }
    }
    const data: any = { ...dto };
    if (data.code) data.code = data.code.toUpperCase();
    return super.update(id, data, userId);
  }

  protected async beforeRemove(role: Role) {
    if (role.isSystem) {
      throw new ForbiddenException('Không thể xoá vai trò hệ thống');
    }
    await ensureNotReferenced(this.connection, role._id, [
      { model: 'User', field: 'roleId', label: 'tài khoản' },
    ]);
  }

  async findByCode(code: string) {
    return this.model.findOne({ code: code.toUpperCase(), isActive: true });
  }

  /** ID các role có quyền cụ thể (không tính role toàn quyền nếu includeAll = false) */
  async findIdsWithPermission(permission: string, includeAll = false) {
    const perms = includeAll ? [permission, ALL_PERMISSIONS] : [permission];
    const roles = await this.model
      .find({ isActive: true, permissions: { $in: perms } })
      .select('_id')
      .lean();
    return roles.map((r) => r._id);
  }

  private validatePermissions(permissions: string[]) {
    const invalid = permissions.filter(
      (p) => p !== ALL_PERMISSIONS && !ALL_PERMISSION_CODES.includes(p),
    );
    if (invalid.length) {
      throw new BadRequestException(
        `Quyền không hợp lệ: ${invalid.join(', ')}`,
      );
    }
  }
}

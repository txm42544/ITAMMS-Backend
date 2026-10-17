import {
  BadRequestException,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import * as bcrypt from 'bcryptjs';
import { Model, Types } from 'mongoose';
import { BaseCrudService } from '../../common/services/base-crud.service';
import { paginate } from '../../common/utils/paginate.util';
import { buildSearchFilter } from '../../common/utils/regex.util';
import { createApiResponse } from '../../common/utils/response.util';
import { RolesService } from '../roles/roles.service';
import {
  CreateUserDto,
  ResetPasswordDto,
  UpdateUserDto,
  UserQueryDto,
} from './dto/user.dto';
import { User } from './schemas/user.schema';

export const USER_POPULATE = [
  { path: 'roleId', select: 'code name' },
  { path: 'departmentId', select: 'code name' },
];

@Injectable()
export class UsersService extends BaseCrudService<User> {
  constructor(
    @InjectModel(User.name) userModel: Model<User>,
    private readonly rolesService: RolesService,
  ) {
    super(userModel, {
      entityName: 'tài khoản',
      searchFields: ['employeeCode', 'username', 'email', 'fullName', 'phone'],
      uniqueFields: ['employeeCode', 'username', 'email'],
      populate: USER_POPULATE,
      optionFields: 'employeeCode fullName departmentId',
      defaultSort: { createdAt: -1 },
    });
  }

  static hashPassword(password: string) {
    return bcrypt.hash(password, 10);
  }

  async create(dto: CreateUserDto, userId: string) {
    await this.rolesService.findEntity(dto.roleId);
    const data = {
      ...dto,
      username: dto.username.toLowerCase(),
      email: dto.email.toLowerCase(),
      employeeCode: dto.employeeCode.toUpperCase(),
      password: await UsersService.hashPassword(dto.password),
    };
    await this.ensureUnique(data);
    const user = await this.model.create({ ...data, createdBy: userId });
    const result = await this.model
      .findById(user._id)
      .populate(USER_POPULATE)
      .lean();
    return createApiResponse(result, 'Thêm tài khoản thành công', 201);
  }

  async findAll(query: UserQueryDto) {
    const filter: Record<string, any> = {
      isActive: true,
      ...buildSearchFilter(query.search, this.options.searchFields),
    };
    if (query.departmentId) filter.departmentId = query.departmentId;
    if (query.roleId) filter.roleId = query.roleId;
    if (query.isLocked !== undefined) filter.isLocked = query.isLocked;
    if (query.roleCode) {
      const role = await this.rolesService.findByCode(query.roleCode);
      filter.roleId = role?._id ?? new Types.ObjectId();
    }
    return paginate(this.model, filter, query, {
      populate: USER_POPULATE,
      message: 'Lấy danh sách tài khoản thành công',
    });
  }

  async update(id: string, dto: UpdateUserDto, userId: string) {
    if (dto.roleId) await this.rolesService.findEntity(dto.roleId);
    const data: any = { ...dto };
    if (data.email) data.email = data.email.toLowerCase();
    if (data.employeeCode) data.employeeCode = data.employeeCode.toUpperCase();
    await super.update(id, data, userId);
    return this.findOne(id).then((r) => ({
      ...r,
      message: 'Cập nhật tài khoản thành công',
    }));
  }

  async setLocked(id: string, isLocked: boolean, currentUserId: string) {
    if (id === currentUserId) {
      throw new BadRequestException('Không thể tự khoá tài khoản của mình');
    }
    const user = await this.findEntity(id);
    user.isLocked = isLocked;
    user.updatedBy = currentUserId as any;
    if (isLocked) user.refreshTokenHash = undefined;
    await user.save();
    return createApiResponse(
      { _id: user._id, isLocked },
      isLocked ? 'Đã khoá tài khoản' : 'Đã mở khoá tài khoản',
    );
  }

  async resetPassword(
    id: string,
    dto: ResetPasswordDto,
    currentUserId: string,
  ) {
    const user = await this.findEntity(id);
    user.password = await UsersService.hashPassword(dto.newPassword);
    user.refreshTokenHash = undefined;
    user.updatedBy = currentUserId as any;
    await user.save();
    return createApiResponse(null, 'Đặt lại mật khẩu thành công');
  }

  protected async beforeRemove(user: User) {
    const role = await this.rolesService.findEntity(String(user.roleId));
    if (role.code === 'ADMIN') {
      const adminCount = await this.model.countDocuments({
        roleId: role._id,
        isActive: true,
      });
      if (adminCount <= 1) {
        throw new ForbiddenException('Không thể xoá quản trị viên cuối cùng');
      }
    }
  }

  async remove(id: string, userId: string) {
    if (id === userId) {
      throw new BadRequestException('Không thể tự xoá tài khoản của mình');
    }
    return super.remove(id, userId);
  }

  /** Lấy user đang hoạt động (dùng nội bộ, ném 404 nếu không có) */
  async getActiveUser(id: string) {
    const user = await this.findEntity(id);
    if (user.isLocked) throw new BadRequestException('Tài khoản đã bị khoá');
    return user;
  }

  /** ID các user (đang hoạt động) có quyền cụ thể — dùng để gửi thông báo */
  async findIdsByPermission(
    permission: string,
    options: { departmentId?: any; includeAdmin?: boolean } = {},
  ): Promise<Types.ObjectId[]> {
    const roleIds = await this.rolesService.findIdsWithPermission(
      permission,
      options.includeAdmin,
    );
    if (!roleIds.length) return [];
    const filter: any = {
      isActive: true,
      isLocked: false,
      roleId: { $in: roleIds },
    };
    if (options.departmentId) filter.departmentId = options.departmentId;
    const users = await this.model.find(filter).select('_id').lean();
    return users.map((u) => u._id as Types.ObjectId);
  }
}

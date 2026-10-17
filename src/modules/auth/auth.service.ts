import {
  BadRequestException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { InjectModel } from '@nestjs/mongoose';
import * as bcrypt from 'bcryptjs';
import { createHash } from 'crypto';
import { Model } from 'mongoose';
import {
  AuthUser,
  JwtPayload,
} from '../../common/interfaces/auth-user.interface';
import { escapeRegex } from '../../common/utils/regex.util';
import { createApiResponse } from '../../common/utils/response.util';
import { ChangePasswordDto, UpdateProfileDto } from '../users/dto/user.dto';
import { User } from '../users/schemas/user.schema';
import { USER_POPULATE, UsersService } from '../users/users.service';
import { LoginDto } from './dto/auth.dto';

@Injectable()
export class AuthService {
  constructor(
    @InjectModel(User.name) private readonly userModel: Model<User>,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
  ) {}

  async login(dto: LoginDto) {
    const identifier = dto.username.trim().toLowerCase();
    const user = await this.userModel
      .findOne({
        isActive: true,
        $or: [
          { username: identifier },
          { email: { $regex: `^${escapeRegex(identifier)}$`, $options: 'i' } },
        ],
      })
      .select('+password');

    if (!user || !(await bcrypt.compare(dto.password, user.password))) {
      throw new UnauthorizedException('Tên đăng nhập hoặc mật khẩu không đúng');
    }
    if (user.isLocked) {
      throw new UnauthorizedException('Tài khoản đã bị khoá');
    }

    const authUser = await this.buildAuthUser(String(user._id));
    const tokens = await this.issueTokens(user);
    user.lastLoginAt = new Date();
    await user.save();

    return createApiResponse(
      { ...tokens, user: authUser },
      'Đăng nhập thành công',
    );
  }

  async refreshToken(refreshToken: string) {
    let payload: JwtPayload;
    try {
      payload = await this.jwtService.verifyAsync<JwtPayload>(refreshToken, {
        secret: this.configService.getOrThrow('JWT_REFRESH_SECRET'),
      });
    } catch {
      throw new UnauthorizedException(
        'Refresh token không hợp lệ hoặc đã hết hạn',
      );
    }
    if (payload.type !== 'refresh') {
      throw new UnauthorizedException('Refresh token không hợp lệ');
    }

    const user = await this.userModel
      .findOne({ _id: payload.sub, isActive: true, isLocked: false })
      .select('+refreshTokenHash');
    if (!user || user.refreshTokenHash !== this.hashToken(refreshToken)) {
      throw new UnauthorizedException('Refresh token đã bị thu hồi');
    }

    const tokens = await this.issueTokens(user);
    return createApiResponse(tokens, 'Làm mới token thành công');
  }

  async logout(userId: string) {
    await this.userModel.updateOne(
      { _id: userId },
      { $unset: { refreshTokenHash: 1 } },
    );
    return createApiResponse(null, 'Đăng xuất thành công');
  }

  async getMe(userId: string) {
    const [profile, authUser] = await Promise.all([
      this.userModel.findById(userId).populate(USER_POPULATE).lean(),
      this.buildAuthUser(userId),
    ]);
    return createApiResponse(
      { ...profile, permissions: authUser.permissions },
      'Lấy thông tin cá nhân thành công',
    );
  }

  async updateProfile(userId: string, dto: UpdateProfileDto) {
    const data: any = { ...dto, updatedBy: userId };
    if (data.email) {
      data.email = data.email.toLowerCase();
      const exists = await this.userModel.exists({
        email: data.email,
        isActive: true,
        _id: { $ne: userId },
      });
      if (exists) throw new BadRequestException('Email đã được sử dụng');
    }
    await this.userModel.updateOne({ _id: userId }, data);
    return this.getMe(userId).then((r) => ({
      ...r,
      message: 'Cập nhật thông tin cá nhân thành công',
    }));
  }

  async changePassword(userId: string, dto: ChangePasswordDto) {
    const user = await this.userModel.findById(userId).select('+password');
    if (!user || !(await bcrypt.compare(dto.currentPassword, user.password))) {
      throw new BadRequestException('Mật khẩu hiện tại không đúng');
    }
    if (dto.currentPassword === dto.newPassword) {
      throw new BadRequestException('Mật khẩu mới phải khác mật khẩu hiện tại');
    }
    user.password = await UsersService.hashPassword(dto.newPassword);
    user.refreshTokenHash = undefined;
    await user.save();
    return createApiResponse(
      null,
      'Đổi mật khẩu thành công, vui lòng đăng nhập lại',
    );
  }

  /** Nạp thông tin user + quyền mới nhất từ DB (gọi mỗi request qua JwtStrategy) */
  async buildAuthUser(userId: string): Promise<AuthUser> {
    const user = await this.userModel
      .findOne({ _id: userId, isActive: true })
      .populate('roleId', 'code permissions isActive')
      .lean();
    const role: any = user?.roleId;
    if (!user || user.isLocked || !role || role.isActive === false) {
      throw new UnauthorizedException('Tài khoản không còn hiệu lực');
    }
    return {
      id: String(user._id),
      username: user.username,
      fullName: user.fullName,
      roleId: String(role._id),
      roleCode: role.code,
      permissions: role.permissions || [],
      departmentId: user.departmentId ? String(user.departmentId) : null,
    };
  }

  private async issueTokens(user: User) {
    const base = { sub: String(user._id), username: user.username };
    const [accessToken, refreshToken] = await Promise.all([
      this.jwtService.signAsync(
        { ...base, type: 'access' },
        {
          secret: this.configService.getOrThrow('JWT_ACCESS_SECRET'),
          expiresIn: this.configService.get('JWT_ACCESS_EXPIRES_IN', '1h'),
        },
      ),
      this.jwtService.signAsync(
        { ...base, type: 'refresh' },
        {
          secret: this.configService.getOrThrow('JWT_REFRESH_SECRET'),
          expiresIn: this.configService.get('JWT_REFRESH_EXPIRES_IN', '7d'),
        },
      ),
    ]);
    await this.userModel.updateOne(
      { _id: user._id },
      { refreshTokenHash: this.hashToken(refreshToken) },
    );
    return { accessToken, refreshToken };
  }

  private hashToken(token: string) {
    return createHash('sha256').update(token).digest('hex');
  }
}

/** Thông tin user gắn vào request sau khi xác thực JWT */
export interface AuthUser {
  id: string;
  username: string;
  fullName: string;
  roleId: string;
  roleCode: string;
  permissions: string[];
  departmentId: string | null;
}

export interface JwtPayload {
  sub: string;
  username: string;
  type: 'access' | 'refresh';
}

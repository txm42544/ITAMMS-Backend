import { SystemRole } from './system-codes';

/** Quyền đặc biệt: toàn quyền */
export const ALL_PERMISSIONS = '*';

export const PERMISSIONS = {
  // Tài khoản & phân quyền
  USER_READ: 'user:read',
  USER_MANAGE: 'user:manage',
  ROLE_MANAGE: 'role:manage',

  // Danh mục hệ thống
  DEPARTMENT_MANAGE: 'department:manage',
  CATALOG_MANAGE: 'catalog:manage',
  SETTING_MANAGE: 'setting:manage',
  ACTIVITY_LOG_READ: 'activity-log:read',

  // Tài sản
  ASSET_READ_ALL: 'asset:read_all',
  ASSET_READ_DEPARTMENT: 'asset:read_department',
  ASSET_CREATE: 'asset:create',
  ASSET_UPDATE: 'asset:update',
  ASSET_DELETE: 'asset:delete',
  ASSET_IMPORT_EXPORT: 'asset:import_export',
  QR_MANAGE: 'qr:manage',

  // Yêu cầu vòng đời (cấp phát / bàn giao / thu hồi / điều chuyển / thanh lý)
  ASSET_REQUEST_READ_ALL: 'asset-request:read_all',
  ASSET_REQUEST_CREATE: 'asset-request:create',
  ASSET_REQUEST_APPROVE_DEPARTMENT: 'asset-request:approve_department',
  ASSET_REQUEST_APPROVE_DISPOSAL: 'asset-request:approve_disposal',
  ASSET_REQUEST_EXECUTE: 'asset-request:execute',

  // Sự cố (helpdesk)
  TICKET_CREATE: 'ticket:create',
  TICKET_READ_ALL: 'ticket:read_all',
  TICKET_READ_DEPARTMENT: 'ticket:read_department',
  TICKET_RECEIVE: 'ticket:receive',
  TICKET_ASSIGN: 'ticket:assign',
  TICKET_PROCESS: 'ticket:process',

  // Đề xuất sửa chữa / thay thế
  REPAIR_REQUEST_READ: 'repair-request:read',
  REPAIR_REQUEST_CREATE: 'repair-request:create',
  REPAIR_REQUEST_APPROVE: 'repair-request:approve',

  // Kho linh kiện
  SPARE_PART_READ: 'spare-part:read',
  SPARE_PART_MANAGE: 'spare-part:manage',
  SPARE_PART_CONSUME: 'spare-part:consume',

  // Bảo trì
  MAINTENANCE_PLAN: 'maintenance:plan',
  MAINTENANCE_READ_ALL: 'maintenance:read_all',
  MAINTENANCE_READ_DEPARTMENT: 'maintenance:read_department',
  MAINTENANCE_EXECUTE: 'maintenance:execute',

  // Báo cáo
  REPORT_VIEW_ALL: 'report:view_all',
  REPORT_VIEW_DEPARTMENT: 'report:view_department',

  // Cảnh báo
  ALERT_RUN: 'alert:run',
} as const;

export type PermissionCode = (typeof PERMISSIONS)[keyof typeof PERMISSIONS];

export interface PermissionGroup {
  module: string;
  name: string;
  permissions: { code: PermissionCode; name: string }[];
}

/** Cây quyền trả về cho FE dựng màn hình phân quyền */
export const PERMISSION_GROUPS: PermissionGroup[] = [
  {
    module: 'user',
    name: 'Tài khoản & phân quyền',
    permissions: [
      { code: PERMISSIONS.USER_READ, name: 'Xem danh sách tài khoản' },
      { code: PERMISSIONS.USER_MANAGE, name: 'Quản lý tài khoản' },
      { code: PERMISSIONS.ROLE_MANAGE, name: 'Quản lý vai trò & phân quyền' },
    ],
  },
  {
    module: 'catalog',
    name: 'Danh mục hệ thống',
    permissions: [
      { code: PERMISSIONS.DEPARTMENT_MANAGE, name: 'Quản lý phòng ban' },
      {
        code: PERMISSIONS.CATALOG_MANAGE,
        name: 'Quản lý danh mục (vị trí, NCC, loại thiết bị, loại sự cố, trạng thái)',
      },
      { code: PERMISSIONS.SETTING_MANAGE, name: 'Cấu hình hệ thống' },
      { code: PERMISSIONS.ACTIVITY_LOG_READ, name: 'Xem nhật ký hoạt động' },
    ],
  },
  {
    module: 'asset',
    name: 'Tài sản',
    permissions: [
      { code: PERMISSIONS.ASSET_READ_ALL, name: 'Xem toàn bộ tài sản' },
      {
        code: PERMISSIONS.ASSET_READ_DEPARTMENT,
        name: 'Xem tài sản phòng ban',
      },
      { code: PERMISSIONS.ASSET_CREATE, name: 'Thêm tài sản' },
      { code: PERMISSIONS.ASSET_UPDATE, name: 'Cập nhật tài sản' },
      { code: PERMISSIONS.ASSET_DELETE, name: 'Xoá tài sản' },
      {
        code: PERMISSIONS.ASSET_IMPORT_EXPORT,
        name: 'Nhập / xuất Excel tài sản',
      },
      { code: PERMISSIONS.QR_MANAGE, name: 'Quản lý QR Code' },
    ],
  },
  {
    module: 'asset-request',
    name: 'Vòng đời tài sản',
    permissions: [
      {
        code: PERMISSIONS.ASSET_REQUEST_READ_ALL,
        name: 'Xem toàn bộ yêu cầu vòng đời',
      },
      {
        code: PERMISSIONS.ASSET_REQUEST_CREATE,
        name: 'Tạo yêu cầu cấp phát / bàn giao / thu hồi / điều chuyển / thanh lý',
      },
      {
        code: PERMISSIONS.ASSET_REQUEST_APPROVE_DEPARTMENT,
        name: 'Phê duyệt cấp phát / bàn giao / thu hồi / điều chuyển (phòng ban)',
      },
      {
        code: PERMISSIONS.ASSET_REQUEST_APPROVE_DISPOSAL,
        name: 'Phê duyệt thanh lý',
      },
      {
        code: PERMISSIONS.ASSET_REQUEST_EXECUTE,
        name: 'Thực hiện yêu cầu đã duyệt',
      },
    ],
  },
  {
    module: 'ticket',
    name: 'Sự cố (Helpdesk)',
    permissions: [
      { code: PERMISSIONS.TICKET_CREATE, name: 'Báo cáo sự cố' },
      { code: PERMISSIONS.TICKET_READ_ALL, name: 'Xem toàn bộ sự cố' },
      { code: PERMISSIONS.TICKET_READ_DEPARTMENT, name: 'Xem sự cố phòng ban' },
      {
        code: PERMISSIONS.TICKET_RECEIVE,
        name: 'Tiếp nhận & phân loại sự cố',
      },
      { code: PERMISSIONS.TICKET_ASSIGN, name: 'Phân công kỹ thuật viên' },
      { code: PERMISSIONS.TICKET_PROCESS, name: 'Xử lý sự cố' },
    ],
  },
  {
    module: 'repair-request',
    name: 'Đề xuất sửa chữa / thay thế',
    permissions: [
      { code: PERMISSIONS.REPAIR_REQUEST_READ, name: 'Xem đề xuất' },
      { code: PERMISSIONS.REPAIR_REQUEST_CREATE, name: 'Tạo đề xuất' },
      { code: PERMISSIONS.REPAIR_REQUEST_APPROVE, name: 'Duyệt đề xuất' },
    ],
  },
  {
    module: 'spare-part',
    name: 'Kho linh kiện / vật tư',
    permissions: [
      { code: PERMISSIONS.SPARE_PART_READ, name: 'Xem kho linh kiện' },
      {
        code: PERMISSIONS.SPARE_PART_MANAGE,
        name: 'Quản lý kho (thêm, nhập, điều chỉnh)',
      },
      {
        code: PERMISSIONS.SPARE_PART_CONSUME,
        name: 'Cập nhật vật tư tiêu hao (xuất kho khi sửa chữa / bảo trì)',
      },
    ],
  },
  {
    module: 'maintenance',
    name: 'Bảo trì',
    permissions: [
      {
        code: PERMISSIONS.MAINTENANCE_PLAN,
        name: 'Lập kế hoạch bảo trì định kỳ',
      },
      { code: PERMISSIONS.MAINTENANCE_READ_ALL, name: 'Xem toàn bộ bảo trì' },
      {
        code: PERMISSIONS.MAINTENANCE_READ_DEPARTMENT,
        name: 'Xem bảo trì phòng ban',
      },
      { code: PERMISSIONS.MAINTENANCE_EXECUTE, name: 'Thực hiện bảo trì' },
    ],
  },
  {
    module: 'report',
    name: 'Báo cáo & thống kê',
    permissions: [
      { code: PERMISSIONS.REPORT_VIEW_ALL, name: 'Xem báo cáo toàn hệ thống' },
      {
        code: PERMISSIONS.REPORT_VIEW_DEPARTMENT,
        name: 'Xem báo cáo phòng ban',
      },
      { code: PERMISSIONS.ALERT_RUN, name: 'Chạy tác vụ cảnh báo thủ công' },
    ],
  },
];

export const ALL_PERMISSION_CODES: string[] = PERMISSION_GROUPS.flatMap((g) =>
  g.permissions.map((p) => p.code),
);

/** Quyền mặc định của các role hệ thống (dùng khi seed) */
export const DEFAULT_ROLE_PERMISSIONS: Record<SystemRole, string[]> = {
  [SystemRole.ADMIN]: [ALL_PERMISSIONS],
  [SystemRole.ASSET_MANAGER]: [
    PERMISSIONS.USER_READ,
    PERMISSIONS.ASSET_READ_ALL,
    PERMISSIONS.ASSET_CREATE,
    PERMISSIONS.ASSET_UPDATE,
    PERMISSIONS.ASSET_DELETE,
    PERMISSIONS.ASSET_IMPORT_EXPORT,
    PERMISSIONS.QR_MANAGE,
    PERMISSIONS.ASSET_REQUEST_READ_ALL,
    PERMISSIONS.ASSET_REQUEST_CREATE,
    PERMISSIONS.ASSET_REQUEST_APPROVE_DISPOSAL,
    PERMISSIONS.ASSET_REQUEST_EXECUTE,
    PERMISSIONS.TICKET_READ_ALL,
    PERMISSIONS.TICKET_ASSIGN,
    PERMISSIONS.REPAIR_REQUEST_READ,
    PERMISSIONS.REPAIR_REQUEST_APPROVE,
    PERMISSIONS.SPARE_PART_READ,
    PERMISSIONS.SPARE_PART_MANAGE,
    PERMISSIONS.MAINTENANCE_PLAN,
    PERMISSIONS.MAINTENANCE_READ_ALL,
    PERMISSIONS.REPORT_VIEW_ALL,
    PERMISSIONS.ALERT_RUN,
  ],
  [SystemRole.TECHNICIAN]: [
    PERMISSIONS.USER_READ,
    PERMISSIONS.ASSET_READ_ALL,
    PERMISSIONS.TICKET_CREATE,
    PERMISSIONS.TICKET_READ_ALL,
    PERMISSIONS.TICKET_RECEIVE,
    PERMISSIONS.TICKET_ASSIGN,
    PERMISSIONS.TICKET_PROCESS,
    PERMISSIONS.REPAIR_REQUEST_READ,
    PERMISSIONS.REPAIR_REQUEST_CREATE,
    PERMISSIONS.SPARE_PART_READ,
    PERMISSIONS.SPARE_PART_CONSUME,
    PERMISSIONS.MAINTENANCE_READ_ALL,
    PERMISSIONS.MAINTENANCE_EXECUTE,
  ],
  [SystemRole.EMPLOYEE]: [PERMISSIONS.TICKET_CREATE],
  [SystemRole.DEPT_MANAGER]: [
    PERMISSIONS.ASSET_READ_DEPARTMENT,
    PERMISSIONS.ASSET_REQUEST_APPROVE_DEPARTMENT,
    PERMISSIONS.TICKET_CREATE,
    PERMISSIONS.TICKET_READ_DEPARTMENT,
    PERMISSIONS.MAINTENANCE_READ_DEPARTMENT,
    PERMISSIONS.REPORT_VIEW_DEPARTMENT,
  ],
};

/** Mã các role hệ thống (seed sẵn, không xoá được) */
export enum SystemRole {
  ADMIN = 'ADMIN',
  ASSET_MANAGER = 'ASSET_MANAGER',
  TECHNICIAN = 'TECHNICIAN',
  EMPLOYEE = 'EMPLOYEE',
  DEPT_MANAGER = 'DEPT_MANAGER',
}

/** Mã các trạng thái tài sản hệ thống — logic vòng đời phụ thuộc vào các mã này */
export enum SystemAssetStatus {
  IN_STOCK = 'IN_STOCK',
  IN_USE = 'IN_USE',
  UNDER_REPAIR = 'UNDER_REPAIR',
  UNDER_MAINTENANCE = 'UNDER_MAINTENANCE',
  BROKEN = 'BROKEN',
  LOST = 'LOST',
  DISPOSED = 'DISPOSED',
}

/** Khoá cấu hình hệ thống (collection settings) */
export enum SettingKey {
  WARRANTY_ALERT_DAYS = 'warrantyAlertDays',
  MAINTENANCE_LEAD_DAYS = 'maintenanceLeadDays',
  TICKET_SLA_DEFAULT_HOURS = 'ticketSlaDefaultHours',
  TICKET_AUTO_CLOSE_DAYS = 'ticketAutoCloseDays',
}

/** Loại đối tượng tham chiếu (dùng cho history, notification, stock transaction) */
export enum RefType {
  ASSET = 'ASSET',
  ASSET_REQUEST = 'ASSET_REQUEST',
  TICKET = 'TICKET',
  REPAIR_REQUEST = 'REPAIR_REQUEST',
  MAINTENANCE_TASK = 'MAINTENANCE_TASK',
  MAINTENANCE_PLAN = 'MAINTENANCE_PLAN',
  SPARE_PART = 'SPARE_PART',
}

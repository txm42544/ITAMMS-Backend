/**
 * Seed dữ liệu nền cho hệ thống quản lý vòng đời tài sản CNTT.
 * Chạy: `pnpm seed`
 *
 * - Roles hệ thống (5 vai trò theo PLAN)
 * - User admin mặc định (username: admin, password: SEED_ADMIN_PASSWORD hoặc Admin@123)
 * - Trạng thái tài sản hệ thống
 * - Loại sự cố phổ biến
 * - Loại thiết bị (Laptop, Desktop, Monitor, Printer, Network)
 * - Phòng ban, vị trí, nhà cung cấp, linh kiện, cấu hình mẫu
 *
 * Sử dụng mongoose trực tiếp để tránh phải khởi tạo toàn bộ AppModule.
 */
import { Logger } from '@nestjs/common';
import * as bcrypt from 'bcryptjs';
import fs from 'fs';
import path from 'path';
import mongoose from 'mongoose';
import {
  SystemRole,
  SystemAssetStatus,
} from '../../common/constants/system-codes';
import { DEFAULT_ROLE_PERMISSIONS } from '../../common/constants/permissions.constant';
import { TicketPriority } from '../../modules/catalogs/schemas/catalog.schemas';
import { DEFAULT_SETTINGS } from '../../modules/catalogs/services/settings.service';

interface SeedSpec {
  code: string;
  name: string;
  description?: string;
  data?: Record<string, any>;
}

const ROLE_SPECS: { code: SystemRole; name: string; description: string }[] = [
  {
    code: SystemRole.ADMIN,
    name: 'Quản trị viên',
    description: 'Toàn quyền hệ thống',
  },
  {
    code: SystemRole.ASSET_MANAGER,
    name: 'Quản lý tài sản',
    description: 'Quản lý vòng đời tài sản, kho, kế hoạch bảo trì',
  },
  {
    code: SystemRole.TECHNICIAN,
    name: 'Kỹ thuật viên',
    description: 'Tiếp nhận và xử lý sự cố, thực hiện bảo trì',
  },
  {
    code: SystemRole.EMPLOYEE,
    name: 'Nhân viên',
    description: 'Báo cáo sự cố, theo dõi tài sản được cấp',
  },
  {
    code: SystemRole.DEPT_MANAGER,
    name: 'Quản lý phòng ban',
    description: 'Phê duyệt yêu cầu tài sản của phòng ban',
  },
];

const STATUS_SPECS: SeedSpec[] = [
  {
    code: SystemAssetStatus.IN_STOCK,
    name: 'Trong kho',
    description: 'Sẵn sàng cấp phát',
    data: { color: '#64748b', order: 10, allowAssign: true },
  },
  {
    code: SystemAssetStatus.IN_USE,
    name: 'Đang sử dụng',
    description: 'Đã cấp phát cho nhân viên',
    data: { color: '#16a34a', order: 20, allowAssign: false },
  },
  {
    code: SystemAssetStatus.UNDER_REPAIR,
    name: 'Đang sửa chữa',
    description: 'KTV đang xử lý sự cố',
    data: { color: '#f59e0b', order: 30, allowAssign: false },
  },
  {
    code: SystemAssetStatus.UNDER_MAINTENANCE,
    name: 'Đang bảo trì',
    description: 'Bảo trì định kỳ',
    data: { color: '#0ea5e9', order: 40, allowAssign: false },
  },
  {
    code: SystemAssetStatus.BROKEN,
    name: 'Hỏng',
    description: 'Chờ xử lý tiếp',
    data: { color: '#ef4444', order: 50, allowAssign: false },
  },
  {
    code: SystemAssetStatus.LOST,
    name: 'Mất',
    description: 'Không tìm thấy',
    data: { color: '#7c3aed', order: 60, allowAssign: false },
  },
  {
    code: SystemAssetStatus.DISPOSED,
    name: 'Đã thanh lý',
    description: 'Kết thúc vòng đời',
    data: { color: '#475569', order: 90, isFinal: true, allowAssign: false },
  },
];

const INCIDENT_SPECS: SeedSpec[] = [
  {
    code: 'HW_BROKEN',
    name: 'Hỏng phần cứng',
    description: 'Lỗi thiết bị vật lý',
    data: { defaultPriority: TicketPriority.HIGH, slaHours: 24 },
  },
  {
    code: 'SW_ERROR',
    name: 'Lỗi phần mềm',
    description: 'Hệ điều hành, ứng dụng',
    data: { defaultPriority: TicketPriority.MEDIUM, slaHours: 24 },
  },
  {
    code: 'NETWORK',
    name: 'Sự cố mạng',
    description: 'Không truy cập được mạng / internet',
    data: { defaultPriority: TicketPriority.HIGH, slaHours: 8 },
  },
  {
    code: 'PERIPHERAL',
    name: 'Hỏng thiết bị ngoại vi',
    description: 'Bàn phím, chuột, màn hình, máy in…',
    data: { defaultPriority: TicketPriority.LOW, slaHours: 48 },
  },
  {
    code: 'REQUEST_INSTALL',
    name: 'Yêu cầu cài đặt',
    description: 'Cài phần mềm, công cụ làm việc',
    data: { defaultPriority: TicketPriority.LOW, slaHours: 48 },
  },
  {
    code: 'OTHER',
    name: 'Khác',
    description: 'Sự cố khác',
    data: { defaultPriority: TicketPriority.MEDIUM, slaHours: 24 },
  },
];

const CATEGORY_SPECS = [
  {
    code: 'LAPTOP',
    name: 'Laptop',
    codePrefix: 'LT',
    description: 'Máy tính xách tay',
    specFields: [
      { key: 'cpu', label: 'CPU', required: true },
      { key: 'ram', label: 'RAM', required: true },
      { key: 'storage', label: 'Ổ cứng', required: true },
      { key: 'os', label: 'Hệ điều hành', required: false },
    ],
    defaultMaintenanceCycleMonths: 6,
    usefulLifeYears: 5,
  },
  {
    code: 'DESKTOP',
    name: 'Máy tính để bàn',
    codePrefix: 'PC',
    description: 'PC nguyên bộ',
    specFields: [
      { key: 'cpu', label: 'CPU', required: true },
      { key: 'ram', label: 'RAM', required: true },
      { key: 'storage', label: 'Ổ cứng', required: true },
      { key: 'os', label: 'Hệ điều hành', required: false },
    ],
    defaultMaintenanceCycleMonths: 12,
    usefulLifeYears: 6,
  },
  {
    code: 'MONITOR',
    name: 'Màn hình',
    codePrefix: 'MN',
    description: 'Màn hình máy tính',
    specFields: [
      { key: 'size', label: 'Kích thước', required: true },
      { key: 'resolution', label: 'Độ phân giải', required: false },
    ],
    defaultMaintenanceCycleMonths: 12,
    usefulLifeYears: 7,
  },
  {
    code: 'PRINTER',
    name: 'Máy in',
    codePrefix: 'PR',
    description: 'Máy in / photocopy',
    specFields: [{ key: 'type', label: 'Loại (laser/inject)', required: true }],
    defaultMaintenanceCycleMonths: 6,
    usefulLifeYears: 7,
  },
  {
    code: 'NETWORK',
    name: 'Thiết bị mạng',
    codePrefix: 'NW',
    description: 'Switch, router, AP…',
    specFields: [{ key: 'ports', label: 'Số cổng', required: false }],
    defaultMaintenanceCycleMonths: 12,
    usefulLifeYears: 6,
  },
];

const DEPARTMENT_SPECS = [
  {
    code: 'IT',
    name: 'Phòng Công nghệ thông tin',
    description: 'Phụ trách hạ tầng CNTT',
  },
  { code: 'HR', name: 'Phòng Nhân sự', description: '' },
  { code: 'ACCT', name: 'Phòng Kế toán', description: '' },
  { code: 'SALES', name: 'Phòng Kinh doanh', description: '' },
];

const LOCATION_SPECS = [
  {
    code: 'A-301',
    name: 'VP A - Phòng 301',
    building: 'Toà A',
    floor: 'Tầng 3',
    room: '301',
  },
  {
    code: 'A-302',
    name: 'VP A - Phòng 302',
    building: 'Toà A',
    floor: 'Tầng 3',
    room: '302',
  },
  {
    code: 'A-IT',
    name: 'Phòng IT',
    building: 'Toà A',
    floor: 'Tầng 3',
    room: '303',
  },
  {
    code: 'B-201',
    name: 'VP B - Phòng 201',
    building: 'Toà B',
    floor: 'Tầng 2',
    room: '201',
  },
];

const SUPPLIER_SPECS = [
  {
    code: 'FPT',
    name: 'Công ty FPT',
    contactPerson: 'Nguyễn Văn A',
    phone: '024 7300 5588',
    email: 'contact@fpt.com',
  },
  {
    code: 'DELL',
    name: 'Dell Việt Nam',
    contactPerson: 'John Smith',
    phone: '028 3520 1234',
    email: 'sales@dell.com',
  },
  {
    code: 'HP',
    name: 'HP Việt Nam',
    contactPerson: 'Trần Thị B',
    phone: '028 3823 4567',
    email: 'sales@hp.com',
  },
];

const SPARE_PART_SPECS = [
  {
    code: 'RAM-8GB',
    name: 'RAM DDR4 8GB 3200MHz',
    unit: 'thanh',
    specification: 'DDR4 8GB 3200MHz',
    minQuantity: 5,
    unitPrice: 800000,
  },
  {
    code: 'RAM-16GB',
    name: 'RAM DDR4 16GB 3200MHz',
    unit: 'thanh',
    specification: 'DDR4 16GB 3200MHz',
    minQuantity: 3,
    unitPrice: 1500000,
  },
  {
    code: 'SSD-256',
    name: 'Ổ cứng SSD 256GB',
    unit: 'cái',
    specification: 'SATA 2.5"',
    minQuantity: 4,
    unitPrice: 900000,
  },
  {
    code: 'SSD-512',
    name: 'Ổ cứng SSD 512GB',
    unit: 'cái',
    specification: 'NVMe M.2',
    minQuantity: 3,
    unitPrice: 1800000,
  },
  {
    code: 'KB-USB',
    name: 'Bàn phím USB',
    unit: 'cái',
    minQuantity: 5,
    unitPrice: 200000,
  },
  {
    code: 'MS-USB',
    name: 'Chuột USB',
    unit: 'cái',
    minQuantity: 5,
    unitPrice: 120000,
  },
  {
    code: 'PIN-LT',
    name: 'Pin laptop',
    unit: 'cái',
    minQuantity: 2,
    unitPrice: 700000,
  },
];

const logger = new Logger('Seed');

async function main() {
  logger.log('Khởi động seed…');
  // Tải .env thủ công (không cần package dotenv)
  loadEnv();
  if (!process.env.MONGO_URI) {
    throw new Error('Thiếu MONGO_URI trong .env');
  }
  await mongoose.connect(process.env.MONGO_URI);
  logger.log('Đã kết nối MongoDB');
  const db = mongoose.connection.db;
  if (!db) throw new Error('Không lấy được database');

  await seedRoles(db);
  await seedUsers(db);
  await seedAssetStatuses(db);
  await seedIncidentTypes(db);
  await seedAssetCategories(db);
  await seedDepartments(db);
  await seedLocations(db);
  await seedSuppliers(db);
  await seedSpareParts(db);
  await seedSettings(db);

  logger.log('Seed hoàn tất!');
  await mongoose.disconnect();
  process.exit(0);
}

async function seedRoles(db: any) {
  for (const r of ROLE_SPECS) {
    const permissions = DEFAULT_ROLE_PERMISSIONS[r.code];
    await db.collection('roles').updateOne(
      { code: r.code },
      {
        $set: {
          code: r.code,
          name: r.name,
          description: r.description,
          permissions,
          isSystem: true,
          isActive: true,
          updatedAt: new Date(),
        },
        $setOnInsert: { createdAt: new Date() },
      },
      { upsert: true },
    );
  }
  log('roles');
}

async function seedUsers(db: any) {
  const adminRole = await db
    .collection('roles')
    .findOne({ code: SystemRole.ADMIN });
  if (!adminRole) return;
  const password = process.env.SEED_ADMIN_PASSWORD || 'Admin@123';
  const passwordHash = await bcrypt.hash(password, 10);
  await db.collection('users').updateOne(
    { username: 'admin' },
    {
      $set: {
        username: 'admin',
        email: 'admin@company.local',
        fullName: 'Quản trị viên',
        employeeCode: 'ADMIN',
        password: passwordHash,
        roleId: adminRole._id,
        isActive: true,
        isLocked: false,
        updatedAt: new Date(),
      },
      $setOnInsert: { createdAt: new Date() },
    },
    { upsert: true },
  );
  log(`users (admin / ${password})`);
}

async function seedAssetStatuses(db: any) {
  for (const s of STATUS_SPECS) {
    await db.collection('assetstatuses').updateOne(
      { code: s.code },
      {
        $set: {
          code: s.code,
          name: s.name,
          description: s.description,
          isSystem: true,
          isActive: true,
          updatedAt: new Date(),
          ...s.data,
        },
        $setOnInsert: { createdAt: new Date() },
      },
      { upsert: true },
    );
  }
  log('asset statuses');
}

async function seedIncidentTypes(db: any) {
  for (const t of INCIDENT_SPECS) {
    await db.collection('incidenttypes').updateOne(
      { code: t.code },
      {
        $set: {
          code: t.code,
          name: t.name,
          description: t.description,
          isSystem: true,
          isActive: true,
          updatedAt: new Date(),
          ...t.data,
        },
        $setOnInsert: { createdAt: new Date() },
      },
      { upsert: true },
    );
  }
  log('incident types');
}

async function seedAssetCategories(db: any) {
  for (const c of CATEGORY_SPECS) {
    await db.collection('assetcategories').updateOne(
      { code: c.code },
      {
        $set: {
          code: c.code,
          name: c.name,
          description: c.description,
          codePrefix: c.codePrefix,
          specFields: c.specFields,
          defaultMaintenanceCycleMonths: c.defaultMaintenanceCycleMonths,
          usefulLifeYears: c.usefulLifeYears,
          isActive: true,
          updatedAt: new Date(),
        },
        $setOnInsert: { createdAt: new Date() },
      },
      { upsert: true },
    );
  }
  log('asset categories');
}

async function seedDepartments(db: any) {
  for (const d of DEPARTMENT_SPECS) {
    await db.collection('departments').updateOne(
      { code: d.code },
      {
        $set: { ...d, isActive: true, updatedAt: new Date() },
        $setOnInsert: { createdAt: new Date() },
      },
      { upsert: true },
    );
  }
  log('departments');
}

async function seedLocations(db: any) {
  for (const l of LOCATION_SPECS) {
    await db.collection('locations').updateOne(
      { code: l.code },
      {
        $set: { ...l, isActive: true, updatedAt: new Date() },
        $setOnInsert: { createdAt: new Date() },
      },
      { upsert: true },
    );
  }
  log('locations');
}

async function seedSuppliers(db: any) {
  for (const s of SUPPLIER_SPECS) {
    await db.collection('suppliers').updateOne(
      { code: s.code },
      {
        $set: { ...s, isActive: true, updatedAt: new Date() },
        $setOnInsert: { createdAt: new Date() },
      },
      { upsert: true },
    );
  }
  log('suppliers');
}

async function seedSpareParts(db: any) {
  for (const p of SPARE_PART_SPECS) {
    await db.collection('spareparts').updateOne(
      { code: p.code },
      {
        $set: {
          code: p.code,
          name: p.name,
          unit: p.unit,
          specification: p.specification,
          minQuantity: p.minQuantity,
          unitPrice: p.unitPrice,
          quantity: 0,
          compatibleCategoryIds: [],
          isActive: true,
          updatedAt: new Date(),
        },
        $setOnInsert: { createdAt: new Date() },
      },
      { upsert: true },
    );
  }
  log('spare parts');
}

async function seedSettings(db: any) {
  for (const s of DEFAULT_SETTINGS) {
    await db.collection('settings').updateOne(
      { key: s.key },
      {
        $set: {
          key: s.key,
          value: s.value,
          type: s.type,
          description: s.description,
          isActive: true,
          updatedAt: new Date(),
        },
        $setOnInsert: { createdAt: new Date() },
      },
      { upsert: true },
    );
  }
  log('settings');
}

function log(name: string) {
  console.log(`  ✓ ${name}`);
}

function loadEnv() {
  const envPath = path.resolve(process.cwd(), '.env');
  if (!fs.existsSync(envPath)) return;
  const content = fs.readFileSync(envPath, 'utf-8');
  for (const line of content.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const idx = trimmed.indexOf('=');
    if (idx <= 0) continue;
    const key = trimmed.slice(0, idx).trim();
    let value = trimmed.slice(idx + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (process.env[key] === undefined) process.env[key] = value;
  }
}

main().catch((err) => {
  console.error('Seed thất bại:', err);
  process.exit(1);
});

import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import ExcelJS from 'exceljs';
import { Model } from 'mongoose';
import { AuthUser } from '../../common/interfaces/auth-user.interface';
import { createApiResponse } from '../../common/utils/response.util';
import {
  AssetCategory,
  Location,
  Supplier,
} from '../catalogs/schemas/catalog.schemas';
import { Department } from '../departments/schemas/department.schema';
import { AssetsService, ASSET_POPULATE } from './assets.service';
import { AssetQueryDto, CreateAssetDto } from './dto/asset.dto';
import { Asset } from './schemas/asset.schema';

/** Cột của file mẫu import (thứ tự cột trong Excel) */
const IMPORT_COLUMNS = [
  { header: 'Tên tài sản (*)', key: 'name', width: 32 },
  { header: 'Mã loại thiết bị (*)', key: 'categoryCode', width: 18 },
  { header: 'Hãng', key: 'brand', width: 14 },
  { header: 'Model', key: 'deviceModel', width: 20 },
  { header: 'Số serial', key: 'serialNumber', width: 20 },
  { header: 'Mã nhà cung cấp', key: 'supplierCode', width: 16 },
  { header: 'Ngày mua (yyyy-mm-dd)', key: 'purchaseDate', width: 20 },
  { header: 'Giá mua', key: 'purchasePrice', width: 14 },
  { header: 'Số hoá đơn', key: 'invoiceNumber', width: 14 },
  { header: 'Số tháng bảo hành', key: 'warrantyMonths', width: 16 },
  { header: 'Mã phòng ban', key: 'departmentCode', width: 14 },
  { header: 'Mã vị trí', key: 'locationCode', width: 14 },
  { header: 'CPU', key: 'cpu', width: 22 },
  { header: 'RAM', key: 'ram', width: 10 },
  { header: 'Ổ cứng', key: 'storage', width: 14 },
  { header: 'Hệ điều hành', key: 'os', width: 18 },
  { header: 'Ghi chú', key: 'notes', width: 24 },
];

const MAX_IMPORT_ROWS = 1000;

@Injectable()
export class AssetsExcelService {
  constructor(
    @InjectModel(Asset.name) private readonly assetModel: Model<Asset>,
    @InjectModel(AssetCategory.name)
    private readonly categoryModel: Model<AssetCategory>,
    @InjectModel(Supplier.name) private readonly supplierModel: Model<Supplier>,
    @InjectModel(Department.name)
    private readonly departmentModel: Model<Department>,
    @InjectModel(Location.name) private readonly locationModel: Model<Location>,
    private readonly assetsService: AssetsService,
  ) {}

  async exportAssets(query: AssetQueryDto, user: AuthUser): Promise<Buffer> {
    const filter = await this.assetsService.buildListFilter(query, user);
    const assets = await this.assetModel
      .find(filter)
      .populate(ASSET_POPULATE)
      .sort({ assetCode: 1 })
      .limit(10000)
      .lean<any[]>();

    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet('Danh sách tài sản');
    sheet.columns = [
      { header: 'STT', key: 'stt', width: 6 },
      { header: 'Mã tài sản', key: 'assetCode', width: 16 },
      { header: 'Tên tài sản', key: 'name', width: 32 },
      { header: 'Loại thiết bị', key: 'category', width: 18 },
      { header: 'Hãng', key: 'brand', width: 12 },
      { header: 'Model', key: 'deviceModel', width: 18 },
      { header: 'Serial', key: 'serialNumber', width: 18 },
      { header: 'Cấu hình', key: 'specs', width: 40 },
      { header: 'Trạng thái', key: 'status', width: 16 },
      { header: 'Phòng ban', key: 'department', width: 20 },
      { header: 'Vị trí', key: 'location', width: 16 },
      { header: 'Người sử dụng', key: 'holder', width: 22 },
      { header: 'Nhà cung cấp', key: 'supplier', width: 20 },
      { header: 'Ngày mua', key: 'purchaseDate', width: 12 },
      { header: 'Giá mua', key: 'purchasePrice', width: 14 },
      { header: 'Hết hạn bảo hành', key: 'warrantyEndDate', width: 16 },
      { header: 'Bảo trì kế tiếp', key: 'nextMaintenanceDate', width: 16 },
    ];
    assets.forEach((a, i) =>
      sheet.addRow({
        stt: i + 1,
        assetCode: a.assetCode,
        name: a.name,
        category: a.categoryId?.name,
        brand: a.brand,
        deviceModel: a.deviceModel,
        serialNumber: a.serialNumber,
        specs: Object.entries(a.specs || {})
          .map(([k, v]) => `${k}: ${v}`)
          .join('; '),
        status: a.statusId?.name,
        department: a.departmentId?.name,
        location: a.locationId?.name,
        holder: a.currentUserId?.fullName,
        supplier: a.supplierId?.name,
        purchaseDate: a.purchaseDate,
        purchasePrice: a.purchasePrice,
        warrantyEndDate: a.warrantyEndDate,
        nextMaintenanceDate: a.nextMaintenanceDate,
      }),
    );
    this.styleSheet(sheet);
    sheet.getColumn('purchasePrice').numFmt = '#,##0';
    for (const key of [
      'purchaseDate',
      'warrantyEndDate',
      'nextMaintenanceDate',
    ]) {
      sheet.getColumn(key).numFmt = 'dd/mm/yyyy';
    }
    return Buffer.from(await workbook.xlsx.writeBuffer());
  }

  async buildTemplate(): Promise<Buffer> {
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet('Tai san');
    sheet.columns = IMPORT_COLUMNS;
    sheet.addRow({
      name: 'Laptop Dell Latitude 5440',
      categoryCode: 'LAPTOP',
      brand: 'Dell',
      deviceModel: 'Latitude 5440',
      serialNumber: 'CN0X1234',
      purchaseDate: '2026-01-15',
      purchasePrice: 22000000,
      warrantyMonths: 36,
      cpu: 'Intel Core i5-1335U',
      ram: '16GB',
      storage: 'SSD 512GB',
      os: 'Windows 11 Pro',
    });
    this.styleSheet(sheet);

    const guide = workbook.addWorksheet('Danh muc');
    guide.columns = [
      { header: 'Loại', key: 'type', width: 16 },
      { header: 'Mã', key: 'code', width: 16 },
      { header: 'Tên', key: 'name', width: 36 },
    ];
    const [categories, suppliers, departments, locations] = await Promise.all([
      this.categoryModel.find({ isActive: true }).select('code name').lean(),
      this.supplierModel.find({ isActive: true }).select('code name').lean(),
      this.departmentModel.find({ isActive: true }).select('code name').lean(),
      this.locationModel.find({ isActive: true }).select('code name').lean(),
    ]);
    const add = (type: string, items: any[]) =>
      items.forEach((i) => guide.addRow({ type, code: i.code, name: i.name }));
    add('Loại thiết bị', categories);
    add('Nhà cung cấp', suppliers);
    add('Phòng ban', departments);
    add('Vị trí', locations);
    this.styleSheet(guide);

    return Buffer.from(await workbook.xlsx.writeBuffer());
  }

  async importAssets(file: Express.Multer.File, user: AuthUser) {
    const workbook = new ExcelJS.Workbook();
    try {
      await workbook.xlsx.load(file.buffer as any);
    } catch {
      throw new BadRequestException('File Excel không hợp lệ');
    }
    const sheet = workbook.worksheets[0];
    if (!sheet || sheet.rowCount < 2) {
      throw new BadRequestException('File không có dữ liệu');
    }
    if (sheet.rowCount - 1 > MAX_IMPORT_ROWS) {
      throw new BadRequestException(
        `Tối đa ${MAX_IMPORT_ROWS} dòng mỗi lần import`,
      );
    }

    const [categories, suppliers, departments, locations] = await Promise.all(
      [
        this.categoryModel,
        this.supplierModel,
        this.departmentModel,
        this.locationModel,
      ].map((m: Model<any>) =>
        m.find({ isActive: true }).select('code').lean(),
      ),
    );
    const toMap = (items: any[]) =>
      new Map(items.map((i) => [String(i.code).toUpperCase(), String(i._id)]));
    const maps = {
      category: toMap(categories),
      supplier: toMap(suppliers),
      department: toMap(departments),
      location: toMap(locations),
    };

    const created: { row: number; assetCode: string }[] = [];
    const errors: { row: number; message: string }[] = [];

    for (let r = 2; r <= sheet.rowCount; r++) {
      const row = sheet.getRow(r);
      const v: Record<string, any> = {};
      IMPORT_COLUMNS.forEach((col, idx) => {
        v[col.key] = this.cellValue(row.getCell(idx + 1).value);
      });
      if (Object.values(v).every((x) => x === null || x === '')) continue;

      try {
        const code = (key: string) =>
          v[key] ? String(v[key]).trim().toUpperCase() : null;
        const lookup = (
          map: Map<string, string>,
          key: string,
          label: string,
        ) => {
          const c = code(key);
          if (!c) return undefined;
          const id = map.get(c);
          if (!id) throw new Error(`${label} "${c}" không tồn tại`);
          return id;
        };

        if (!v.name) throw new Error('Thiếu tên tài sản');
        const categoryId = lookup(
          maps.category,
          'categoryCode',
          'Loại thiết bị',
        );
        if (!categoryId) throw new Error('Thiếu mã loại thiết bị');

        const specs: Record<string, any> = {};
        for (const k of ['cpu', 'ram', 'storage', 'os']) {
          if (v[k]) specs[k] = String(v[k]);
        }
        const dto: CreateAssetDto = {
          name: String(v.name),
          categoryId,
          brand: v.brand ? String(v.brand) : undefined,
          deviceModel: v.deviceModel ? String(v.deviceModel) : undefined,
          serialNumber: v.serialNumber ? String(v.serialNumber) : undefined,
          supplierId: lookup(maps.supplier, 'supplierCode', 'Nhà cung cấp'),
          departmentId: lookup(maps.department, 'departmentCode', 'Phòng ban'),
          locationId: lookup(maps.location, 'locationCode', 'Vị trí'),
          purchaseDate: this.toIsoDate(v.purchaseDate),
          purchasePrice: v.purchasePrice ? Number(v.purchasePrice) : undefined,
          invoiceNumber: v.invoiceNumber ? String(v.invoiceNumber) : undefined,
          warrantyMonths: v.warrantyMonths
            ? Number(v.warrantyMonths)
            : undefined,
          specs,
          notes: v.notes ? String(v.notes) : undefined,
        };
        const res = await this.assetsService.create(dto, user);
        created.push({ row: r, assetCode: res.data.assetCode });
      } catch (error) {
        errors.push({
          row: r,
          message: error?.response?.message || error.message,
        });
      }
    }

    return createApiResponse(
      {
        createdCount: created.length,
        errorCount: errors.length,
        created,
        errors,
      },
      `Import hoàn tất: ${created.length} thành công, ${errors.length} lỗi`,
    );
  }

  private cellValue(value: ExcelJS.CellValue): any {
    if (value === null || value === undefined) return null;
    if (value instanceof Date) return value;
    if (typeof value === 'object') {
      if ('result' in value) return (value as any).result;
      if ('text' in value) return (value as any).text;
      if ('richText' in value) {
        return (value as any).richText.map((t: any) => t.text).join('');
      }
    }
    return typeof value === 'string' ? value.trim() : value;
  }

  private toIsoDate(value: any): string | undefined {
    if (!value) return undefined;
    const d = value instanceof Date ? value : new Date(String(value));
    if (isNaN(d.getTime())) throw new Error(`Ngày không hợp lệ: ${value}`);
    return d.toISOString();
  }

  private styleSheet(sheet: ExcelJS.Worksheet) {
    const header = sheet.getRow(1);
    header.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    header.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF1D4ED8' },
    };
    header.alignment = {
      vertical: 'middle',
      horizontal: 'center',
      wrapText: true,
    };
    sheet.views = [{ state: 'frozen', ySplit: 1 }];
  }
}

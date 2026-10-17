import { Model, PopulateOptions, SortOrder } from 'mongoose';
import { PaginationQueryDto } from '../dto/pagination-query.dto';
import { createPaginatedResponse } from './response.util';

export interface PaginateOptions {
  populate?: string | PopulateOptions | (string | PopulateOptions)[];
  select?: string;
  defaultSort?: Record<string, SortOrder>;
  message?: string;
}

/** Truy vấn phân trang chuẩn, trả về response có `pagination` */
export async function paginate<T>(
  model: Model<T>,
  filter: Record<string, any>,
  query: PaginationQueryDto,
  options: PaginateOptions = {},
) {
  const page = query.page || 1;
  const limit = query.limit || 10;
  const sort: Record<string, SortOrder> = query.sortBy
    ? { [query.sortBy]: query.sortOrder === 'asc' ? 1 : -1 }
    : options.defaultSort || { createdAt: -1 };

  let q = model
    .find(filter)
    .sort(sort)
    .skip((page - 1) * limit)
    .limit(limit);
  if (options.select) q = q.select(options.select);
  if (options.populate) q = q.populate(options.populate as any);

  const [data, total] = await Promise.all([
    q.lean().exec(),
    model.countDocuments(filter),
  ]);

  return createPaginatedResponse(
    data as any[],
    total,
    page,
    limit,
    options.message || 'Lấy danh sách thành công',
  );
}

/** Thêm điều kiện khoảng thời gian vào filter */
export function applyDateRange(
  filter: Record<string, any>,
  field: string,
  fromDate?: string,
  toDate?: string,
) {
  if (!fromDate && !toDate) return filter;
  filter[field] = {};
  if (fromDate) filter[field].$gte = startOfDay(new Date(fromDate));
  if (toDate) filter[field].$lte = endOfDay(new Date(toDate));
  return filter;
}

export function startOfDay(d: Date): Date {
  const r = new Date(d);
  r.setHours(0, 0, 0, 0);
  return r;
}

export function endOfDay(d: Date): Date {
  const r = new Date(d);
  r.setHours(23, 59, 59, 999);
  return r;
}

export function addDays(d: Date, days: number): Date {
  const r = new Date(d);
  r.setDate(r.getDate() + days);
  return r;
}

export function addInterval(
  d: Date,
  value: number,
  unit: 'DAY' | 'WEEK' | 'MONTH',
): Date {
  const r = new Date(d);
  if (unit === 'DAY') r.setDate(r.getDate() + value);
  else if (unit === 'WEEK') r.setDate(r.getDate() + value * 7);
  else r.setMonth(r.getMonth() + value);
  return r;
}

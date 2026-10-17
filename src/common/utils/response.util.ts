export const API_VERSION = '1.0';

export interface PaginationType {
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface MetaType {
  timestamp: string;
  apiVersion: string;
}

export interface ApiResponseType<T = any> {
  statusCode: number;
  message: string;
  data: T;
  meta: MetaType;
}

export interface ApiResponsePaginationType<T = any> {
  statusCode: number;
  message: string;
  data: T[];
  pagination: PaginationType;
  meta: MetaType;
}

export function createMeta(): MetaType {
  return {
    timestamp: new Date().toISOString(),
    apiVersion: API_VERSION,
  };
}

export function createApiResponse<T = any>(
  data: T,
  message = 'Thành công',
  statusCode = 200,
): ApiResponseType<T> {
  return { statusCode, message, data, meta: createMeta() };
}

export function createPaginatedResponse<T = any>(
  data: T[],
  total: number,
  page: number,
  limit: number,
  message = 'Thành công',
  statusCode = 200,
): ApiResponsePaginationType<T> {
  return {
    statusCode,
    message,
    data,
    pagination: {
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit) || 0,
    },
    meta: createMeta(),
  };
}

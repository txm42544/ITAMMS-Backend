/** Escape ký tự đặc biệt để dùng chuỗi người dùng nhập trong $regex an toàn */
export function escapeRegex(input: string): string {
  return String(input).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** Tạo điều kiện $or tìm kiếm không phân biệt hoa thường trên nhiều trường */
export function buildSearchFilter(
  search: string | undefined,
  fields: string[],
): Record<string, any> {
  if (!search || !search.trim() || !fields.length) return {};
  const regex = { $regex: escapeRegex(search.trim()), $options: 'i' };
  return { $or: fields.map((f) => ({ [f]: regex })) };
}

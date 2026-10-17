import { StreamableFile } from '@nestjs/common';
import { Response } from 'express';

export const XLSX_MIME =
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

/** Trả file về client (dùng với @Res({ passthrough: true })) */
export function fileResponse(
  res: Response,
  buffer: Buffer,
  filename: string,
  contentType = XLSX_MIME,
  inline = false,
): StreamableFile {
  res.set({
    'Content-Type': contentType,
    'Content-Disposition': `${inline ? 'inline' : 'attachment'}; filename="${encodeURIComponent(filename)}"`,
  });
  return new StreamableFile(buffer);
}

export function dateStamp(date = new Date()) {
  return date.toISOString().slice(0, 10).replace(/-/g, '');
}

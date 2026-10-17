import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { v2 as cloudinary } from 'cloudinary';

export interface UploadedFileInfo {
  publicId: string;
  url: string;
  format: string;
  bytes: number;
  originalName: string;
  resourceType: string;
}

@Injectable()
export class UploadService {
  private readonly logger = new Logger(UploadService.name);
  private readonly enabled: boolean;

  constructor(configService: ConfigService) {
    const cloudName = configService.get<string>('CLOUDINARY_CLOUD_NAME');
    this.enabled = !!cloudName;
    cloudinary.config({
      cloud_name: cloudName,
      api_key: configService.get<string>('CLOUDINARY_API_KEY'),
      api_secret: configService.get<string>('CLOUDINARY_API_SECRET'),
    });
  }

  /** Upload ảnh (ảnh tài sản, ảnh sự cố...) — tự resize tối đa 1600px */
  async uploadImage(file: Express.Multer.File, folder = 'images') {
    return this.upload(file, folder, 'image', [
      { width: 1600, height: 1600, crop: 'limit' },
      { quality: 'auto' },
    ]);
  }

  /** Upload tài liệu (hoá đơn, biên bản bàn giao PDF/Word/Excel) */
  async uploadDocument(file: Express.Multer.File, folder = 'documents') {
    return this.upload(file, folder, 'raw');
  }

  async deleteFile(publicId: string, resourceType: 'image' | 'raw' = 'image') {
    this.ensureEnabled();
    return cloudinary.uploader.destroy(publicId, {
      resource_type: resourceType,
    });
  }

  private async upload(
    file: Express.Multer.File,
    folder: string,
    resourceType: 'image' | 'raw',
    transformation?: any[],
  ): Promise<UploadedFileInfo> {
    this.ensureEnabled();
    try {
      const result = await cloudinary.uploader.upload(
        `data:${file.mimetype};base64,${file.buffer.toString('base64')}`,
        {
          folder: `it-asset-management/${folder}`,
          resource_type: resourceType,
          use_filename: true,
          transformation,
        },
      );
      return {
        publicId: result.public_id,
        url: result.secure_url,
        format: result.format,
        bytes: result.bytes,
        originalName: file.originalname,
        resourceType,
      };
    } catch (error) {
      this.logger.error(`Upload thất bại: ${error.message}`);
      throw new InternalServerErrorException('Upload file thất bại');
    }
  }

  private ensureEnabled() {
    if (!this.enabled) {
      throw new BadRequestException(
        'Chưa cấu hình Cloudinary (CLOUDINARY_CLOUD_NAME...)',
      );
    }
  }
}

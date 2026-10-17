import {
  BadRequestException,
  Controller,
  Delete,
  HttpCode,
  HttpStatus,
  Post,
  Query,
  UploadedFile,
  UploadedFiles,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor, FilesInterceptor } from '@nestjs/platform-express';
import {
  ApiBearerAuth,
  ApiBody,
  ApiConsumes,
  ApiOperation,
  ApiQuery,
  ApiTags,
} from '@nestjs/swagger';
import { createApiResponse } from '../../common/utils/response.util';
import { UploadService } from './upload.service';

const IMAGE_MIME = /^image\/(jpe?g|png|gif|webp)$/;
const DOCUMENT_MIME = [
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
];

const imageFilter = (_req: any, file: Express.Multer.File, cb: any) =>
  IMAGE_MIME.test(file.mimetype)
    ? cb(null, true)
    : cb(
        new BadRequestException('Chỉ chấp nhận ảnh jpg, png, gif, webp'),
        false,
      );

const documentFilter = (_req: any, file: Express.Multer.File, cb: any) =>
  DOCUMENT_MIME.includes(file.mimetype)
    ? cb(null, true)
    : cb(new BadRequestException('Chỉ chấp nhận file PDF, Word, Excel'), false);

const fileBody = (multiple = false) => ({
  schema: {
    type: 'object',
    properties: multiple
      ? {
          files: { type: 'array', items: { type: 'string', format: 'binary' } },
        }
      : { file: { type: 'string', format: 'binary' } },
  },
});

@ApiTags('Upload')
@ApiBearerAuth('access-token')
@Controller('upload')
export class UploadController {
  constructor(private readonly uploadService: UploadService) {}

  @ApiOperation({ summary: 'Upload 1 ảnh (tối đa 5MB)' })
  @ApiConsumes('multipart/form-data')
  @ApiBody(fileBody())
  @HttpCode(HttpStatus.CREATED)
  @UseInterceptors(
    FileInterceptor('file', {
      fileFilter: imageFilter,
      limits: { fileSize: 5 * 1024 * 1024 },
    }),
  )
  @Post('image')
  async uploadImage(@UploadedFile() file: Express.Multer.File) {
    if (!file) throw new BadRequestException('Vui lòng chọn file');
    const data = await this.uploadService.uploadImage(file);
    return createApiResponse(data, 'Upload ảnh thành công', HttpStatus.CREATED);
  }

  @ApiOperation({ summary: 'Upload nhiều ảnh (tối đa 5 ảnh, mỗi ảnh 5MB)' })
  @ApiConsumes('multipart/form-data')
  @ApiBody(fileBody(true))
  @HttpCode(HttpStatus.CREATED)
  @UseInterceptors(
    FilesInterceptor('files', 5, {
      fileFilter: imageFilter,
      limits: { fileSize: 5 * 1024 * 1024 },
    }),
  )
  @Post('images')
  async uploadImages(@UploadedFiles() files: Express.Multer.File[]) {
    if (!files?.length) throw new BadRequestException('Vui lòng chọn file');
    const data = await Promise.all(
      files.map((f) => this.uploadService.uploadImage(f)),
    );
    return createApiResponse(data, 'Upload ảnh thành công', HttpStatus.CREATED);
  }

  @ApiOperation({ summary: 'Upload tài liệu PDF/Word/Excel (tối đa 20MB)' })
  @ApiConsumes('multipart/form-data')
  @ApiBody(fileBody())
  @HttpCode(HttpStatus.CREATED)
  @UseInterceptors(
    FileInterceptor('file', {
      fileFilter: documentFilter,
      limits: { fileSize: 20 * 1024 * 1024 },
    }),
  )
  @Post('document')
  async uploadDocument(@UploadedFile() file: Express.Multer.File) {
    if (!file) throw new BadRequestException('Vui lòng chọn file');
    const data = await this.uploadService.uploadDocument(file);
    return createApiResponse(
      data,
      'Upload tài liệu thành công',
      HttpStatus.CREATED,
    );
  }

  @ApiOperation({ summary: 'Xoá file theo publicId' })
  @ApiQuery({ name: 'publicId', required: true })
  @ApiQuery({ name: 'type', enum: ['image', 'raw'], required: false })
  @Delete()
  async deleteFile(
    @Query('publicId') publicId: string,
    @Query('type') type: 'image' | 'raw' = 'image',
  ) {
    if (!publicId) throw new BadRequestException('Thiếu publicId');
    const data = await this.uploadService.deleteFile(publicId, type);
    return createApiResponse(data, 'Xoá file thành công');
  }
}

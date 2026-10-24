import {
  Controller,
  Post,
  Get,
  Param,
  Res,
  UseGuards,
  UseInterceptors,
  UploadedFile,
  BadRequestException,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { Throttle } from '@nestjs/throttler';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { diskStorage } from 'multer';
import type { Response } from 'express';
import path from 'path';
import fs from 'fs';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { UPLOADS_DIR } from '../../core/paths';

const MAGIC_BYTES: Record<string, (buf: Buffer) => boolean> = {
  'image/jpeg': (b) => b[0] === 0xFF && b[1] === 0xD8 && b[2] === 0xFF,
  'image/png': (b) => b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4E && b[3] === 0x47,
  'application/pdf': (b) => b[0] === 0x25 && b[1] === 0x50 && b[2] === 0x44 && b[3] === 0x46,
  'application/msword': (b) => b[0] === 0xD0 && b[1] === 0xCF && b[2] === 0x11 && b[3] === 0xE0,
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': (b) => b[0] === 0x50 && b[1] === 0x4B && b[2] === 0x03 && b[3] === 0x04,
  'application/vnd.ms-excel': (b) => b[0] === 0xD0 && b[1] === 0xCF && b[2] === 0x11 && b[3] === 0xE0,
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': (b) => b[0] === 0x50 && b[1] === 0x4B && b[2] === 0x03 && b[3] === 0x04,
  'audio/wav': (b) => b[0] === 0x52 && b[1] === 0x49 && b[2] === 0x46 && b[3] === 0x46,
  'audio/mpeg': (b) => (b[0] === 0x49 && b[1] === 0x44 && b[2] === 0x33) || (b[0] === 0xFF && (b[1] & 0xE0) === 0xE0),
  'audio/webm': (b) => b[0] === 0x1A && b[1] === 0x45 && b[2] === 0xDF && b[3] === 0xA3,
};

const ALLOWED_EXTENSIONS = ['.jpeg', '.jpg', '.png', '.pdf', '.doc', '.docx', '.xls', '.xlsx', '.wav', '.mp3', '.webm'];
const ALLOWED_MIMETYPES = [
  'image/jpeg', 'image/png',
  'application/pdf',
  'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'audio/wav', 'audio/mpeg', 'audio/webm',
];

if (!fs.existsSync(UPLOADS_DIR)) {
  fs.mkdirSync(UPLOADS_DIR, { recursive: true });
}

@ApiTags('Uploads')
@ApiBearerAuth()
@Controller('api/uploads')
@UseGuards(JwtAuthGuard)
export class UploadsController {
  @Post()
  @Throttle({ upload: {} })
  @ApiOperation({ summary: 'Upload an attachment or voice note with magic-byte validation' })
  @UseInterceptors(
    FileInterceptor('file', {
      storage: diskStorage({
        destination: (_req, _file, cb) => {
          if (!fs.existsSync(UPLOADS_DIR)) {
            fs.mkdirSync(UPLOADS_DIR, { recursive: true });
          }
          cb(null, UPLOADS_DIR);
        },
        filename: (_req, file, cb) => {
          const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
          cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
        },
      }),
      limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit
      fileFilter: (_req, file, cb) => {
        const ext = path.extname(file.originalname).toLowerCase();
        if (ALLOWED_EXTENSIONS.includes(ext) && ALLOWED_MIMETYPES.includes(file.mimetype)) {
          return cb(null, true);
        }
        cb(new BadRequestException('Invalid file type. Allowed: JPEG, PNG, PDF, DOC, DOCX, XLS, XLSX, WAV, MP3, WEBM'), false);
      },
    }),
  )
  uploadFile(@UploadedFile() file: Express.Multer.File) {
    if (!file) {
      throw new BadRequestException({ message: 'No file uploaded' });
    }

    const validateMagic = MAGIC_BYTES[file.mimetype];
    if (validateMagic) {
      const buf = Buffer.alloc(8);
      const fd = fs.openSync(file.path, 'r');
      fs.readSync(fd, buf, 0, 8, 0);
      fs.closeSync(fd);
      if (!validateMagic(buf)) {
        fs.unlinkSync(file.path);
        throw new UnprocessableEntityException({ message: 'File content does not match declared MIME type' });
      }
    }

    const fileUrl = `/uploads/${file.filename}`;
    return {
      fileName: file.originalname,
      fileUrl,
      fileSize: file.size,
      mimeType: file.mimetype,
    };
  }

  @Get('download/:filename')
  @ApiOperation({ summary: 'Securely download an uploaded attachment' })
  downloadFile(@Param('filename') filename: string, @Res() res: Response) {
    const sanitized = path.basename(filename);
    const uploadsRoot = path.resolve(UPLOADS_DIR);
    const filePath = path.resolve(uploadsRoot, sanitized);

    if (!filePath.startsWith(uploadsRoot + path.sep) && filePath !== uploadsRoot) {
      throw new BadRequestException({ message: 'Invalid filename' });
    }

    if (!fs.existsSync(filePath)) {
      throw new NotFoundException({ message: 'File not found' });
    }

    return res.download(filePath, sanitized);
  }
}

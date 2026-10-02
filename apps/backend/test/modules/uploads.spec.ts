import {
    BadGatewayException,
    BadRequestException,
    ForbiddenException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Role } from '@prisma/client';

import {
    ENUM_FILE_STORE,
    FILE_MAX_IMAGE_SIZE,
    FILE_MAX_PDF_SIZE,
} from 'src/common/file/enums/files.enum';
import { detectImageType, detectPdf } from 'src/common/file/file-signature';
import { FileService } from 'src/common/file/services/files.service';
import {
    DEFAULT_IMAGE_PURPOSE,
    DEFAULT_PDF_PURPOSE,
    IMAGE_UPLOAD_PURPOSES,
    PDF_UPLOAD_PURPOSES,
    resolveUploadStore,
} from 'src/modules/uploads/upload-purpose';

const JPEG = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46]);
const PNG = Buffer.from([
    0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00,
]);
const WEBP = Buffer.concat([
    Buffer.from('RIFF'),
    Buffer.from([0x24, 0x00, 0x00, 0x00]),
    Buffer.from('WEBPVP8 '),
]);
const PDF = Buffer.from('%PDF-1.7\n%âãÏÓ\n');
const HTML = Buffer.from('<html><script>alert(1)</script></html>');

describe('file signature sniffing', () => {
    it('detects JPEG, PNG and WEBP from bytes', () => {
        expect(detectImageType(JPEG)).toEqual({
            mime: 'image/jpeg',
            ext: 'jpg',
        });
        expect(detectImageType(PNG)).toEqual({ mime: 'image/png', ext: 'png' });
        expect(detectImageType(WEBP)).toEqual({
            mime: 'image/webp',
            ext: 'webp',
        });
    });

    it('rejects non-images, truncated headers and RIFF that is not WEBP', () => {
        expect(detectImageType(HTML)).toBeNull();
        expect(detectImageType(PDF)).toBeNull();
        expect(detectImageType(Buffer.from([0xff, 0xd8]))).toBeNull();
        expect(detectImageType(Buffer.from('RIFF\0\0\0\0WAVEfmt '))).toBeNull();
        expect(detectImageType(Buffer.alloc(0))).toBeNull();
    });

    it('detects PDF only by the %PDF- signature', () => {
        expect(detectPdf(PDF)).toEqual({ mime: 'application/pdf', ext: 'pdf' });
        expect(detectPdf(JPEG)).toBeNull();
        expect(detectPdf(Buffer.from('%PD'))).toBeNull();
    });
});

describe('upload purpose → storage folder', () => {
    const image = (purpose: string | undefined, role: Role) =>
        resolveUploadStore(
            IMAGE_UPLOAD_PURPOSES,
            purpose,
            DEFAULT_IMAGE_PURPOSE,
            role
        );

    it('defaults to avatars so existing clients keep working', () => {
        expect(image(undefined, Role.RESIDENT)).toBe(
            ENUM_FILE_STORE.USER_AVATARS
        );
        expect(image('', Role.RESIDENT)).toBe(ENUM_FILE_STORE.USER_AVATARS);
    });

    it('routes feedback attachments to their own folder', () => {
        expect(image('feedback', Role.RESIDENT)).toBe(
            ENUM_FILE_STORE.FEEDBACK_ATTACHMENTS
        );
    });

    it('restricts staff/admin folders by role', () => {
        expect(() => image('product', Role.RESIDENT)).toThrow(
            ForbiddenException
        );
        expect(image('product', Role.MERCHANT)).toBe(
            ENUM_FILE_STORE.PRODUCT_IMAGES
        );
        expect(() => image('announcement', Role.MERCHANT)).toThrow(
            ForbiddenException
        );
        expect(image('candidate', Role.ADMIN)).toBe(
            ENUM_FILE_STORE.CANDIDATE_PHOTOS
        );
    });

    it('rejects unknown purposes, including prototype keys', () => {
        expect(() => image('../../etc', Role.ADMIN)).toThrow(
            BadRequestException
        );
        expect(() => image('constructor', Role.ADMIN)).toThrow(
            BadRequestException
        );
    });

    it('stores PDFs as reports by default (ADMIN only)', () => {
        expect(
            resolveUploadStore(
                PDF_UPLOAD_PURPOSES,
                undefined,
                DEFAULT_PDF_PURPOSE,
                Role.ADMIN
            )
        ).toBe(ENUM_FILE_STORE.REPORTS);
        expect(() =>
            resolveUploadStore(
                PDF_UPLOAD_PURPOSES,
                undefined,
                DEFAULT_PDF_PURPOSE,
                Role.RESIDENT
            )
        ).toThrow(ForbiddenException);
    });
});

describe('FileService', () => {
    const upload = jest.fn();
    const getPublicUrl = jest.fn();
    const createBucket = jest.fn();
    let service: FileService;

    beforeEach(() => {
        jest.clearAllMocks();
        const config = {
            getOrThrow: (key: string) =>
                ({
                    'supabase.url': 'http://localhost:9002',
                    'supabase.serviceKey': 'test-service-key',
                    'supabase.bucket': 'test-bucket',
                })[key],
        } as unknown as ConfigService;
        service = new FileService(config);
        (service as unknown as { supabase: unknown }).supabase = {
            storage: {
                from: () => ({ upload, getPublicUrl }),
                createBucket,
            },
        };
        getPublicUrl.mockImplementation((path: string) => ({
            data: { publicUrl: `https://cdn.test/${path}` },
        }));
    });

    it('stores with sniffed content type and extension, ignoring the filename', async () => {
        upload.mockResolvedValue({ error: null });

        const result = await service.uploadImage(
            PNG,
            ENUM_FILE_STORE.FEEDBACK_ATTACHMENTS,
            'user-1'
        );

        const [path, , options] = upload.mock.calls[0];
        expect(path).toMatch(/^feedback-attachments\/user-1\/\d+-[0-9a-f-]+\.png$/);
        expect(options).toEqual({ contentType: 'image/png', upsert: false });
        expect(result).toEqual({ url: `https://cdn.test/${path}`, path });
    });

    it('rejects a non-image disguised as an image', async () => {
        await expect(
            service.uploadImage(HTML, ENUM_FILE_STORE.USER_AVATARS, 'user-1')
        ).rejects.toBeInstanceOf(BadRequestException);
        expect(upload).not.toHaveBeenCalled();
    });

    it('enforces size limits (image ≤ 5 MB, PDF ≤ 20 MB)', async () => {
        const bigImage = Buffer.concat([JPEG, Buffer.alloc(FILE_MAX_IMAGE_SIZE)]);
        await expect(
            service.uploadImage(bigImage, ENUM_FILE_STORE.USER_AVATARS, 'u')
        ).rejects.toBeInstanceOf(BadRequestException);

        const bigPdf = Buffer.concat([PDF, Buffer.alloc(FILE_MAX_PDF_SIZE)]);
        await expect(
            service.uploadPdf(bigPdf, ENUM_FILE_STORE.REPORTS, 'u')
        ).rejects.toBeInstanceOf(BadRequestException);
        expect(upload).not.toHaveBeenCalled();
    });

    it('rejects a non-PDF on the PDF path and stores real PDFs as .pdf', async () => {
        await expect(
            service.uploadPdf(JPEG, ENUM_FILE_STORE.REPORTS, 'admin-1')
        ).rejects.toBeInstanceOf(BadRequestException);

        upload.mockResolvedValue({ error: null });
        const result = await service.uploadPdf(
            PDF,
            ENUM_FILE_STORE.REPORTS,
            'admin-1'
        );
        expect(result.path).toMatch(/^reports\/admin-1\/.+\.pdf$/);
        expect(upload.mock.calls[0][2].contentType).toBe('application/pdf');
    });

    it('fails loudly with a safe 502 code and never auto-creates the bucket', async () => {
        upload.mockResolvedValue({ error: { message: 'Bucket not found' } });

        const attempt = service.uploadImage(
            JPEG,
            ENUM_FILE_STORE.USER_AVATARS,
            'user-1'
        );
        await expect(attempt).rejects.toBeInstanceOf(BadGatewayException);
        await expect(attempt).rejects.toThrow('storage_unavailable');
        expect(createBucket).not.toHaveBeenCalled();
        expect(upload).toHaveBeenCalledTimes(1);
    });
});

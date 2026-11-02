import {
    BadGatewayException,
    BadRequestException,
    NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Role } from '@prisma/client';

import supabaseConfig from 'src/common/config/supabase.config';
import { DatabaseService } from 'src/common/database/services/database.service';
import {
    FILE_MAX_IMAGE_SIZE,
    FINANCE_MAX_PDF_SIZE,
} from 'src/common/file/enums/files.enum';
import {
    FINANCE_SIGNED_URL_TTL_SEC,
    isFinanceAttachmentPath,
    isOwnStagingPath,
    PrivateFileService,
} from 'src/common/file/services/private-file.service';
import { isStoragePublicUrl } from 'src/common/file/storage-url';
import { redactUrlForLog } from 'src/common/logger/redact-url';
import { FinanceAttachmentsService } from 'src/modules/finance/finance-attachments.service';
import { FinanceAuditService } from 'src/modules/finance/kernel/finance-audit.service';

const JPEG = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46]);
const PDF = Buffer.from('%PDF-1.7\n');
const HTML = Buffer.from('<html></html>');

function config(values: Record<string, string | undefined> = {}) {
    const all: Record<string, string | undefined> = {
        'supabase.url': 'https://proj.supabase.co',
        'supabase.serviceKey': 'service-key',
        'supabase.bucket': 'eastpark-uploads',
        'supabase.financeBucket': 'eastpark-finance',
        ...values,
    };
    return {
        getOrThrow: (key: string) => {
            const v = all[key];
            if (v === undefined) throw new Error(`missing ${key}`);
            return v;
        },
    } as unknown as ConfigService;
}

function fakeStorage() {
    const bucket = {
        upload: jest.fn().mockResolvedValue({ error: null }),
        createSignedUrl: jest.fn(async (path: string, ttl: number) => ({
            data: {
                signedUrl: `https://proj.supabase.co/storage/v1/object/sign/eastpark-finance/${path}?token=t&ttl=${ttl}`,
            },
            error: null,
        })),
        copy: jest.fn().mockResolvedValue({ error: null }),
        remove: jest.fn().mockResolvedValue({ error: null }),
        list: jest.fn(),
        getPublicUrl: jest.fn(),
    };
    const storage = {
        from: jest.fn(() => bucket),
        getBucket: jest
            .fn()
            .mockResolvedValue({ data: { public: false }, error: null }),
    };
    return { bucket, storage };
}

function build(values?: Record<string, string | undefined>) {
    const service = new PrivateFileService(config(values));
    const fake = fakeStorage();
    (service as unknown as { supabase: unknown }).supabase = {
        storage: fake.storage,
    };
    return { service, ...fake };
}

describe('PrivateFileService (plan 5)', () => {
    describe('boot check', () => {
        it('the default config boots: a separate private bucket named eastpark-finance', () => {
            const saved = process.env.SUPABASE_FINANCE_BUCKET;
            delete process.env.SUPABASE_FINANCE_BUCKET;
            try {
                const values = supabaseConfig() as Record<string, unknown>;
                expect(values.financeBucket).toBe('eastpark-finance');
                const real = new ConfigService({
                    supabase: { ...values, serviceKey: 'k' },
                });
                expect(new PrivateFileService(real).bucketName).toBe(
                    'eastpark-finance'
                );
            } finally {
                if (saved !== undefined)
                    process.env.SUPABASE_FINANCE_BUCKET = saved;
            }
        });

        it('uses the configured private bucket', () => {
            expect(build().service.bucketName).toBe('eastpark-finance');
        });

        it('refuses to start without a finance bucket name', () => {
            expect(
                () =>
                    new PrivateFileService(
                        config({ 'supabase.financeBucket': undefined })
                    )
            ).toThrow('missing supabase.financeBucket');
            expect(
                () =>
                    new PrivateFileService(
                        config({ 'supabase.financeBucket': '  ' })
                    )
            ).toThrow('must not be empty');
        });

        it('refuses to start when it is the public uploads bucket', () => {
            expect(
                () =>
                    new PrivateFileService(
                        config({ 'supabase.financeBucket': 'EastPark-Uploads' })
                    )
            ).toThrow('separate private bucket');
        });
    });

    describe('uploadStaging', () => {
        it('stores a sniffed image under staging/<owner>/ in the private bucket, never a URL', async () => {
            const { service, storage, bucket } = build();
            const out = await service.uploadStaging(JPEG, 'usr_1');
            expect(out.path).toMatch(/^staging\/usr_1\/\d+-[0-9a-f-]+\.jpg$/);
            expect(Object.keys(out)).toEqual(['path']);
            expect(storage.from).toHaveBeenCalledWith('eastpark-finance');
            expect(storage.from).not.toHaveBeenCalledWith('eastpark-uploads');
            expect(bucket.upload).toHaveBeenCalledWith(out.path, JPEG, {
                contentType: 'image/jpeg',
                upsert: false,
            });
            expect(bucket.getPublicUrl).not.toHaveBeenCalled();
            expect(isOwnStagingPath(out.path, 'usr_1')).toBe(true);
        });

        it('accepts a PDF up to 10 MB and images up to 5 MB only', async () => {
            const { service } = build();
            await expect(service.uploadStaging(PDF, 'u')).resolves.toEqual({
                path: expect.stringMatching(/\.pdf$/),
            });
            await expect(
                service.uploadStaging(
                    Buffer.concat([PDF, Buffer.alloc(FINANCE_MAX_PDF_SIZE)]),
                    'u'
                )
            ).rejects.toThrow('finance.error.attachmentTooLarge');
            await expect(
                service.uploadStaging(
                    Buffer.concat([JPEG, Buffer.alloc(FILE_MAX_IMAGE_SIZE)]),
                    'u'
                )
            ).rejects.toThrow('finance.error.attachmentTooLarge');
            await expect(service.uploadStaging(HTML, 'u')).rejects.toThrow(
                new BadRequestException('finance.error.attachmentType')
            );
        });

        it('refuses to write into a public or missing bucket (502), and re-checks later', async () => {
            const { service, storage, bucket } = build();
            storage.getBucket.mockResolvedValueOnce({
                data: { public: true },
                error: null,
            });
            await expect(service.uploadStaging(JPEG, 'u')).rejects.toThrow(
                new BadGatewayException('storage_unavailable')
            );
            storage.getBucket.mockResolvedValueOnce({
                data: null,
                error: { message: 'Bucket not found' },
            });
            await expect(service.uploadStaging(JPEG, 'u')).rejects.toThrow(
                'storage_unavailable'
            );
            expect(bucket.upload).not.toHaveBeenCalled();
            await service.uploadStaging(JPEG, 'u');
            await service.uploadStaging(JPEG, 'u');
            expect(storage.getBucket).toHaveBeenCalledTimes(3); // success cached
        });

        it('maps a storage error to 502 storage_unavailable', async () => {
            const { service, bucket } = build();
            bucket.upload.mockResolvedValueOnce({ error: { message: 'x' } });
            await expect(service.uploadStaging(JPEG, 'u')).rejects.toThrow(
                'storage_unavailable'
            );
        });
    });

    describe('createSignedUrl', () => {
        it('asks for exactly 60 seconds and reports the expiry', async () => {
            const { service, bucket } = build();
            const before = Date.now();
            const out = await service.createSignedUrl(
                'receipts/2026/R-2026-000001/1-a.jpg'
            );
            expect(FINANCE_SIGNED_URL_TTL_SEC).toBe(60);
            expect(bucket.createSignedUrl).toHaveBeenCalledWith(
                'receipts/2026/R-2026-000001/1-a.jpg',
                60
            );
            const ms = out.expiresAt.getTime() - before;
            expect(ms).toBeGreaterThanOrEqual(60_000);
            expect(ms).toBeLessThan(61_000);
            expect(
                isStoragePublicUrl(
                    out.url,
                    'https://proj.supabase.co',
                    'eastpark-uploads'
                )
            ).toBe(false);
        });

        it('refuses a non-finance path and maps storage errors', async () => {
            const { service, bucket } = build();
            await expect(
                service.createSignedUrl('user-avatars/u/a.jpg')
            ).rejects.toThrow('finance.error.attachmentNotFound');
            bucket.createSignedUrl.mockResolvedValueOnce({
                data: null,
                error: { message: 'Object not found' },
            } as never);
            await expect(
                service.createSignedUrl('receipts/2026/R-2026-000001/a.jpg')
            ).rejects.toThrow('storage_unavailable');
        });
    });

    it('copy / remove report success and never throw', async () => {
        const { service, bucket } = build();
        await expect(
            service.copy('staging/u/a.jpg', 'receipts/2026/R/a.jpg')
        ).resolves.toBe(true);
        bucket.copy.mockResolvedValueOnce({ error: { message: 'exists' } });
        await expect(service.copy('a', 'b')).resolves.toBe(false);
        await expect(service.remove([])).resolves.toBe(true);
        bucket.remove.mockResolvedValueOnce({ error: { message: 'x' } });
        await expect(service.remove(['a'])).resolves.toBe(false);
    });

    it('lists staged objects older than a cut-off, one folder per uploader', async () => {
        const { service, bucket } = build();
        bucket.list.mockImplementation(async (prefix: string) => {
            if (prefix === 'staging')
                return {
                    data: [
                        { name: 'usr_1', id: null },
                        {
                            name: 'stray.jpg',
                            id: 'f0',
                            created_at: '2020-01-01T00:00:00Z',
                        },
                    ],
                    error: null,
                };
            return {
                data: [
                    {
                        name: 'old.jpg',
                        id: 'f1',
                        created_at: '2026-11-01T00:00:00Z',
                    },
                    {
                        name: 'new.jpg',
                        id: 'f2',
                        created_at: '2026-11-20T00:00:00Z',
                    },
                    { name: 'nodate.jpg', id: 'f3', created_at: null },
                ],
                error: null,
            };
        });
        const out = await service.listStagingBefore(
            new Date('2026-11-10T00:00:00Z')
        );
        expect(out.map(o => o.path)).toEqual(['staging/usr_1/old.jpg']);
        bucket.list.mockResolvedValueOnce({
            data: null,
            error: { message: 'x' },
        });
        await expect(service.listStagingBefore(new Date())).resolves.toEqual(
            []
        );
    });

    it.each([
        ['receipts/2026/R-2026-000001/1-a.jpg', true],
        ['staging/usr_1/1-a.pdf', true],
        ['expenses/2026/E-2026-000001/a.pdf', true],
        ['staging/usr_1/../usr_2/a.jpg', false],
        ['staging/./a.jpg', false],
        ['user-avatars/u/a.jpg', false],
        ['/receipts/2026/a.jpg', false],
        ['receipts', false],
        ['receipts//a.jpg', false],
        ['https://x/receipts/a.jpg', false],
        [42, false],
    ])('isFinanceAttachmentPath(%p) = %p', (path, expected) => {
        expect(isFinanceAttachmentPath(path)).toBe(expected);
    });
});

describe('FinanceAttachmentsService (plan 5.2, 3.7)', () => {
    const actor = { userId: 'acc-1', role: Role.ACCOUNTANT };
    const PATH = 'receipts/2026/R-2026-000001/1-a.jpg';

    function setup(row: Record<string, unknown> | null = {}) {
        const audits: Record<string, unknown>[] = [];
        const auditCreate = jest.fn(
            async ({ data }: { data: Record<string, unknown> }) => {
                audits.push(data);
                return { id: 'a' };
            }
        );
        const findFirst = jest.fn(async () =>
            row === null
                ? null
                : {
                      id: 'pay-1',
                      receiptNo: 'R-2026-000001',
                      attachmentPath: PATH,
                      flat: { id: 'flat-1', label: 'A1-3-2' },
                      ...row,
                  }
        );
        const db = {
            payment: { findFirst },
            auditLog: { create: auditCreate },
        };
        const files = {
            createSignedUrl: jest.fn(async () => ({
                url: 'https://signed.example/x',
                expiresAt: new Date(Date.now() + 60_000),
            })),
            uploadStaging: jest.fn(async () => ({
                path: 'staging/acc-1/1-a.jpg',
            })),
        };
        const service = new FinanceAttachmentsService(
            db as unknown as DatabaseService,
            new FinanceAuditService(),
            files as unknown as PrivateFileService
        );
        return { service, files, audits, auditCreate, findFirst };
    }

    it('every issue writes an ATTACHMENT_VIEWED row before the URL is created', async () => {
        const { service, files, audits, auditCreate } = setup();
        const first = await service.signedUrl({ paymentId: 'pay-1' }, actor);
        await service.signedUrl({ path: PATH }, actor);
        expect(first).toEqual({
            url: 'https://signed.example/x',
            expiresAt: expect.any(Date),
            expiresInSeconds: 60,
        });
        expect(audits).toHaveLength(2);
        expect(audits[0]).toMatchObject({
            userId: 'acc-1',
            action: 'ATTACHMENT_VIEWED',
            entity: 'Payment',
            entityId: 'pay-1',
            meta: expect.objectContaining({
                ttlSeconds: 60,
                receiptNo: 'R-2026-000001',
            }),
        });
        expect(JSON.stringify(audits)).not.toContain(PATH);
        expect(auditCreate.mock.invocationCallOrder[0]).toBeLessThan(
            files.createSignedUrl.mock.invocationCallOrder[0] as number
        );
        expect(files.createSignedUrl).toHaveBeenCalledWith(PATH);
    });

    it('no URL without its audit row', async () => {
        const { service, files, auditCreate } = setup();
        auditCreate.mockRejectedValueOnce(new Error('db down'));
        await expect(
            service.signedUrl({ paymentId: 'pay-1' }, actor)
        ).rejects.toThrow('db down');
        expect(files.createSignedUrl).not.toHaveBeenCalled();
    });

    it('unknown payment, no attachment or a foreign path is 404 (not 403), unaudited', async () => {
        const none = setup(null);
        await expect(
            none.service.signedUrl({ paymentId: 'x' }, actor)
        ).rejects.toThrow(
            new NotFoundException('finance.error.attachmentNotFound')
        );
        const bare = setup({ attachmentPath: null });
        await expect(
            bare.service.signedUrl({ paymentId: 'pay-1' }, actor)
        ).rejects.toThrow('finance.error.attachmentNotFound');
        const odd = setup();
        await expect(
            odd.service.signedUrl({ path: 'user-avatars/u/a.jpg' }, actor)
        ).rejects.toThrow('finance.error.attachmentNotFound');
        expect(odd.findFirst).not.toHaveBeenCalled();
        expect([none, bare, odd].every(s => s.audits.length === 0)).toBe(true);
    });

    it('needs exactly one of paymentId and path', async () => {
        const { service } = setup();
        await expect(service.signedUrl({}, actor)).rejects.toThrow(
            new BadRequestException('finance.error.attachmentQueryInvalid')
        );
        await expect(
            service.signedUrl({ paymentId: 'pay-1', path: PATH }, actor)
        ).rejects.toThrow('finance.error.attachmentQueryInvalid');
    });

    it('upload returns the private path only', async () => {
        const { service, files } = setup();
        await expect(service.upload(JPEG, actor)).resolves.toEqual({
            path: 'staging/acc-1/1-a.jpg',
        });
        expect(files.uploadStaging).toHaveBeenCalledWith(JPEG, 'acc-1');
    });
});

describe('redactUrlForLog (plan 9 "Logging")', () => {
    it.each([
        [
            '/v1/finance/attachments/signed-url?path=receipts/2026/x.jpg',
            '/v1/finance/attachments/signed-url?[redacted]',
        ],
        ['/v1/finance/payments?q=TRX-1', '/v1/finance/payments?[redacted]'],
        ['/v1/finance/payments', '/v1/finance/payments'],
        ['/v1/shops?q=cafe', '/v1/shops?q=cafe'],
        [undefined, ''],
    ])('%p -> %p', (url, expected) => {
        expect(redactUrlForLog(url)).toBe(expected);
    });
});

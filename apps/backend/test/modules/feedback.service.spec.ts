import { BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import { Role } from '@prisma/client';

import { DatabaseService } from 'src/common/database/services/database.service';
import { FeedbackService } from 'src/modules/feedback/feedback.service';

const row = {
    id: 'f1',
    isAnonymous: true,
    userId: 'u1',
    category: 'GENERAL',
    body: 'x',
    status: 'OPEN',
    attachments: [],
    createdAt: new Date(),
    updatedAt: new Date(),
};
const db = { feedback: { findMany: jest.fn(), create: jest.fn() } };
const STORAGE =
    'https://proj.supabase.co/storage/v1/object/public/eastpark-uploads';
const config = {
    getOrThrow: jest.fn(
        (key: string) =>
            ({
                'supabase.url': 'https://proj.supabase.co',
                'supabase.bucket': 'eastpark-uploads',
            })[key]
    ),
};

// Owner decision: admins keep seeing the author of anonymous feedback.
describe('FeedbackService anonymous masking', () => {
    let service: FeedbackService;
    beforeEach(async () => {
        jest.clearAllMocks();
        db.feedback.findMany.mockResolvedValue([{ ...row }]);
        const m = await Test.createTestingModule({
            providers: [
                FeedbackService,
                { provide: DatabaseService, useValue: db },
                { provide: ConfigService, useValue: config },
            ],
        }).compile();
        service = m.get(FeedbackService);
    });

    it('admin sees userId on anonymous feedback', async () => {
        const r = await service.findAll({} as any, {
            userId: 'admin',
            role: Role.ADMIN,
        });
        expect(r.items[0]!.userId).toBe('u1');
    });

    it('non-admin does not get userId on anonymous feedback', async () => {
        const r = await service.findAll({} as any, {
            userId: 'u1',
            role: Role.RESIDENT,
        });
        expect(r.items[0]!.userId).toBeNull();
    });
});

describe('FeedbackService.create attachment URLs', () => {
    let service: FeedbackService;
    const actor = { userId: 'u1', role: Role.RESIDENT };
    beforeEach(async () => {
        jest.clearAllMocks();
        db.feedback.create.mockResolvedValue({ ...row });
        const m = await Test.createTestingModule({
            providers: [
                FeedbackService,
                { provide: DatabaseService, useValue: db },
                { provide: ConfigService, useValue: config },
            ],
        }).compile();
        service = m.get(FeedbackService);
    });

    const dto = (attachments?: string[]) =>
        ({ category: 'OTHER', body: 'x', attachments }) as any;

    it('accepts attachments uploaded to our bucket', async () => {
        const url = `${STORAGE}/feedback-attachments/u1/1-a.jpg`;
        await service.create(dto([url]), actor);
        expect(db.feedback.create).toHaveBeenCalledWith({
            data: expect.objectContaining({ attachments: [url] }),
        });
    });

    it('accepts no attachments', async () => {
        await service.create(dto(undefined), actor);
        expect(db.feedback.create).toHaveBeenCalled();
    });

    it.each([
        'https://evil.example/x.jpg',
        `${STORAGE.replace('https:', 'http:')}/a.jpg`,
        `${STORAGE}-other/a.jpg`,
        `${STORAGE}/../other-bucket/a.jpg`,
    ])('rejects %s with 400 before writing', async url => {
        await expect(
            service.create(dto([`${STORAGE}/ok.jpg`, url]), actor)
        ).rejects.toThrow(new BadRequestException('file.error.urlNotStored'));
        expect(db.feedback.create).not.toHaveBeenCalled();
    });
});

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
const db = { feedback: { findMany: jest.fn() } };

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

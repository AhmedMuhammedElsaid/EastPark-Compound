import { Logger } from '@nestjs/common';
import { Role } from '@prisma/client';

import { AuditService } from 'src/modules/audit/audit.service';

describe('AuditService', () => {
    let db: { auditLog: { create: jest.Mock; findMany: jest.Mock } };
    let service: AuditService;

    beforeEach(() => {
        db = { auditLog: { create: jest.fn(), findMany: jest.fn() } };
        service = new AuditService(db as never);
    });

    describe('record', () => {
        it('writes an entry for ADMIN and SUPER_ADMIN actors', async () => {
            db.auditLog.create.mockResolvedValue({});
            await service.record(
                { userId: 'a1', role: Role.ADMIN },
                'POLL_CREATED',
                'Poll',
                'p1',
                { label: 'Pool hours?' }
            );
            await service.record(
                { userId: 's1', role: Role.SUPER_ADMIN },
                'USER_ROLE_CHANGED',
                'User',
                'u1',
                { label: 'Sara (sara@x.com)', fromRole: 'RESIDENT', toRole: 'ADMIN' }
            );
            expect(db.auditLog.create).toHaveBeenNthCalledWith(1, {
                data: {
                    userId: 'a1',
                    action: 'POLL_CREATED',
                    entity: 'Poll',
                    entityId: 'p1',
                    meta: { label: 'Pool hours?' },
                },
            });
            expect(db.auditLog.create).toHaveBeenCalledTimes(2);
        });

        it('skips non-admin and missing actors', async () => {
            await service.record(
                { userId: 'm1', role: Role.MERCHANT },
                'PRODUCT_CREATED',
                'Product',
                'x',
                { label: 'Bread' }
            );
            await service.record(
                { userId: 'r1', role: Role.RESIDENT },
                'COMMENT_CREATED',
                'Comment',
                'c',
                { label: 'Hello' }
            );
            await service.record(undefined, 'SHOP_CREATED', 'Shop', 's', {
                label: 'Cafe',
            });
            expect(db.auditLog.create).not.toHaveBeenCalled();
        });

        it('swallows and logs a failed write', async () => {
            const logSpy = jest
                .spyOn(Logger.prototype, 'error')
                .mockImplementation(() => undefined);
            db.auditLog.create.mockRejectedValue(new Error('db down'));
            await expect(
                service.record(
                    { userId: 'a1', role: Role.ADMIN },
                    'REPORT_CREATED',
                    'Report',
                    'r1',
                    { label: 'Q3' }
                )
            ).resolves.toBeUndefined();
            expect(logSpy).toHaveBeenCalled();
            logSpy.mockRestore();
        });
    });

    describe('listActivity', () => {
        const row = (id: string) => ({
            id,
            action: 'LEAD_APPROVED',
            entity: 'ResidentLead',
            entityId: 'l1',
            meta: { label: 'Sara — B1/2/3', email: 'sara@x.com' },
            createdAt: new Date('2026-10-04T10:00:00Z'),
            user: {
                id: 'a1',
                name: 'Sameh',
                email: 'sameh@x.com',
                role: Role.ADMIN,
            },
        });

        it('returns items newest first with the actor and a next cursor', async () => {
            db.auditLog.findMany.mockResolvedValue([
                row('e3'),
                row('e2'),
                row('e1'),
            ]);
            const page = await service.listActivity({ limit: 2 });

            expect(db.auditLog.findMany).toHaveBeenCalledWith(
                expect.objectContaining({
                    where: {},
                    take: 3,
                    orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
                })
            );
            expect(page.nextCursor).toBe('e2');
            expect(page.items).toHaveLength(2);
            expect(page.items[0]).toEqual({
                id: 'e3',
                action: 'LEAD_APPROVED',
                entity: 'ResidentLead',
                entityId: 'l1',
                meta: { label: 'Sara — B1/2/3', email: 'sara@x.com' },
                createdAt: new Date('2026-10-04T10:00:00Z'),
                actor: {
                    id: 'a1',
                    name: 'Sameh',
                    email: 'sameh@x.com',
                    role: Role.ADMIN,
                },
            });
        });

        it('filters by actor, resumes after the cursor and nulls non-object meta', async () => {
            db.auditLog.findMany.mockResolvedValue([
                { ...row('e1'), meta: null },
            ]);
            const page = await service.listActivity({
                cursor: 'e2',
                actorId: 'a1',
            });
            expect(db.auditLog.findMany).toHaveBeenCalledWith(
                expect.objectContaining({
                    where: { userId: 'a1' },
                    take: 21,
                    skip: 1,
                    cursor: { id: 'e2' },
                })
            );
            expect(page.nextCursor).toBeUndefined();
            expect(page.items[0].meta).toBeNull();
        });
    });
});

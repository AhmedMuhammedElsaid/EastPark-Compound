import { ConflictException, NotFoundException } from '@nestjs/common';
import { ListingStatus, ListingType, NotificationType, Role } from '@prisma/client';

import { DatabaseService } from 'src/common/database/services/database.service';
import { AuditService } from 'src/modules/audit/audit.service';
import { LISTING_VALIDITY_MS } from 'src/modules/listings/listing.constants';
import { ListingNotifier } from 'src/modules/listings/listing.notifier';
import { ListingsAdminService } from 'src/modules/listings/listings.admin.service';
import { NotificationsService } from 'src/modules/notifications/notifications.service';

const admin = { userId: 'admin-1', role: Role.ADMIN };
const ALL_STATUSES = Object.values(ListingStatus);

const row = (overrides: Record<string, unknown> = {}) => ({
    id: 'l1',
    ownerId: 'u1',
    type: ListingType.RENT,
    status: ListingStatus.PENDING,
    building: 'A1',
    floor: '3',
    flatNumber: '2',
    price: 15000,
    areaSqm: 140,
    bedrooms: 3,
    bathrooms: 2,
    furnished: true,
    description: null,
    contactPhone: '01012345678',
    photos: ['https://x/y.jpg'],
    rejectReason: null,
    approvedAt: null,
    expiresAt: null,
    reviewedById: null,
    createdAt: new Date('2026-10-30T10:00:00.000Z'),
    updatedAt: new Date('2026-10-30T10:00:00.000Z'),
    owner: {
        id: 'u1',
        name: 'Sara',
        email: 'sara@example.com',
        phone: '01012345678',
    },
    _count: { revisions: 2 },
    ...overrides,
});

function build() {
    const db = {
        listing: {
            findMany: jest.fn(),
            findUnique: jest.fn(),
            findFirst: jest.fn().mockResolvedValue(null),
            updateMany: jest.fn().mockResolvedValue({ count: 1 }),
            groupBy: jest.fn(),
        },
        listingRevision: { findMany: jest.fn() },
    };
    const audit = { record: jest.fn().mockResolvedValue(undefined) };
    const notifier = { notify: jest.fn().mockResolvedValue(undefined) };
    const service = new ListingsAdminService(
        db as unknown as DatabaseService,
        audit as unknown as AuditService,
        notifier as unknown as ListingNotifier
    );
    return { db, audit, notifier, service };
}

describe('ListingsAdminService approve', () => {
    it.each(ALL_STATUSES)('approve from %s', async status => {
        const { db, service } = build();
        db.listing.findUnique.mockResolvedValue(row({ status }));

        const result = service.approve('l1', admin);

        if (status === ListingStatus.PENDING) {
            await expect(result).resolves.toBeDefined();
        } else {
            await expect(result).rejects.toThrow(
                new ConflictException('listing.error.invalidStatus')
            );
            expect(db.listing.updateMany).not.toHaveBeenCalled();
        }
    });

    it('sets APPROVED with a 60-day expiry, records the reviewer, audits and notifies', async () => {
        const { db, audit, notifier, service } = build();
        db.listing.findUnique.mockResolvedValue(row());

        const out = await service.approve('l1', admin);

        const call = db.listing.updateMany.mock.calls[0][0];
        expect(call.where).toEqual({
            id: 'l1',
            status: { in: [ListingStatus.PENDING] },
        });
        expect(call.data.status).toBe(ListingStatus.APPROVED);
        expect(call.data.reviewedById).toBe('admin-1');
        expect(call.data.rejectReason).toBeNull();
        expect(call.data.expiresAt.getTime() - call.data.approvedAt.getTime()).toBe(
            LISTING_VALIDITY_MS
        );
        expect(audit.record).toHaveBeenCalledWith(
            admin,
            'LISTING_APPROVED',
            'Listing',
            'l1',
            expect.objectContaining({ unitLabel: 'A1-3-2' })
        );
        expect(notifier.notify).toHaveBeenCalledWith(
            'APPROVED',
            'u1',
            'l1',
            'A1-3-2'
        );
        expect(out.owner).toMatchObject({
            email: 'sara@example.com',
            phone: '01012345678',
        });
        expect(out.revisionCount).toBe(2);
    });

    it('re-checks one-active-per-flat and refuses when another listing holds it', async () => {
        const { db, audit, service } = build();
        db.listing.findUnique.mockResolvedValue(row());
        db.listing.findFirst.mockResolvedValue({ id: 'other' });

        await expect(service.approve('l1', admin)).rejects.toThrow(
            new ConflictException('listing.error.unitAlreadyListed')
        );
        expect(db.listing.updateMany).not.toHaveBeenCalled();
        expect(audit.record).not.toHaveBeenCalled();
    });

    it('maps a unique-index race on approve to 409 unitAlreadyListed', async () => {
        const { db, service } = build();
        db.listing.findUnique.mockResolvedValue(row());
        db.listing.updateMany.mockRejectedValue({ code: 'P2002' });

        await expect(service.approve('l1', admin)).rejects.toThrow(
            new ConflictException('listing.error.unitAlreadyListed')
        );
    });

    it('answers 409 and does not audit or notify when the status changed under us', async () => {
        const { db, audit, notifier, service } = build();
        db.listing.findUnique.mockResolvedValue(row());
        db.listing.updateMany.mockResolvedValue({ count: 0 });

        await expect(service.approve('l1', admin)).rejects.toThrow(
            new ConflictException('listing.error.invalidStatus')
        );
        expect(audit.record).not.toHaveBeenCalled();
        expect(notifier.notify).not.toHaveBeenCalled();
    });

    it('answers 404 for an unknown listing', async () => {
        const { db, service } = build();
        db.listing.findUnique.mockResolvedValue(null);

        await expect(service.approve('nope', admin)).rejects.toThrow(
            new NotFoundException('listing.error.notFound')
        );
    });
});

describe('ListingsAdminService reject', () => {
    it.each(ALL_STATUSES)('reject from %s', async status => {
        const { db, service } = build();
        db.listing.findUnique.mockResolvedValue(row({ status }));

        const result = service.reject('l1', 'Blurry photos', admin);

        if (
            status === ListingStatus.PENDING ||
            status === ListingStatus.APPROVED
        ) {
            await expect(result).resolves.toBeDefined();
        } else {
            await expect(result).rejects.toThrow(
                new ConflictException('listing.error.invalidStatus')
            );
            expect(db.listing.updateMany).not.toHaveBeenCalled();
        }
    });

    it('rejects a PENDING listing: stores the reason, clears dates, audits LISTING_REJECTED', async () => {
        const { db, audit, notifier, service } = build();
        db.listing.findUnique.mockResolvedValue(row());

        await service.reject('l1', 'Blurry photos', admin);

        const call = db.listing.updateMany.mock.calls[0][0];
        expect(call.where).toEqual({
            id: 'l1',
            status: { in: [ListingStatus.PENDING] },
        });
        expect(call.data).toEqual({
            status: ListingStatus.REJECTED,
            rejectReason: 'Blurry photos',
            approvedAt: null,
            expiresAt: null,
            reviewedById: 'admin-1',
        });
        expect(audit.record).toHaveBeenCalledWith(
            admin,
            'LISTING_REJECTED',
            'Listing',
            'l1',
            expect.objectContaining({ reason: 'Blurry photos' })
        );
        expect(notifier.notify).toHaveBeenCalledWith(
            'REJECTED',
            'u1',
            'l1',
            'A1-3-2'
        );
    });

    it('takes down an APPROVED listing and audits LISTING_TAKEN_DOWN', async () => {
        const { db, audit, service } = build();
        db.listing.findUnique.mockResolvedValue(
            row({ status: ListingStatus.APPROVED })
        );

        await service.reject('l1', 'Not allowed', admin);

        expect(db.listing.updateMany.mock.calls[0][0].where).toEqual({
            id: 'l1',
            status: { in: [ListingStatus.APPROVED] },
        });
        expect(audit.record).toHaveBeenCalledWith(
            admin,
            'LISTING_TAKEN_DOWN',
            'Listing',
            'l1',
            expect.objectContaining({ reason: 'Not allowed' })
        );
    });

    it('answers 409 when the status changed under us', async () => {
        const { db, audit, service } = build();
        db.listing.findUnique.mockResolvedValue(row());
        db.listing.updateMany.mockResolvedValue({ count: 0 });

        await expect(service.reject('l1', 'Reason', admin)).rejects.toThrow(
            new ConflictException('listing.error.invalidStatus')
        );
        expect(audit.record).not.toHaveBeenCalled();
    });

    it('answers 404 for an unknown listing', async () => {
        const { db, service } = build();
        db.listing.findUnique.mockResolvedValue(null);

        await expect(service.reject('nope', 'Reason', admin)).rejects.toThrow(
            NotFoundException
        );
    });
});

describe('ListingsAdminService stats', () => {
    it('zero-fills every status and sums the total', async () => {
        const { db, service } = build();
        db.listing.groupBy.mockResolvedValue([
            { status: ListingStatus.PENDING, _count: { _all: 3 } },
            { status: ListingStatus.APPROVED, _count: { _all: 5 } },
        ]);

        await expect(service.stats()).resolves.toEqual({
            PENDING: 3,
            APPROVED: 5,
            REJECTED: 0,
            SOLD: 0,
            RENTED: 0,
            WITHDRAWN: 0,
            EXPIRED: 0,
            total: 8,
        });
    });

    it('returns all zeros for an empty table', async () => {
        const { db, service } = build();
        db.listing.groupBy.mockResolvedValue([]);

        const stats = await service.stats();

        expect(stats.total).toBe(0);
        expect(Object.keys(stats).sort()).toEqual(
            [...ALL_STATUSES, 'total'].sort()
        );
    });
});

describe('ListingsAdminService reads', () => {
    it('findAll filters by status/type/q and pages with the last returned id', async () => {
        const { db, service } = build();
        db.listing.findMany.mockResolvedValue([
            row({ id: 'a' }),
            row({ id: 'b' }),
            row({ id: 'c' }),
        ]);

        const page = await service.findAll({
            status: ListingStatus.PENDING,
            type: ListingType.RENT,
            q: 'sara',
            limit: 2,
        });

        const args = db.listing.findMany.mock.calls[0][0];
        expect(args.where).toMatchObject({
            status: ListingStatus.PENDING,
            type: ListingType.RENT,
        });
        expect(args.where.OR).toHaveLength(2);
        expect(args.take).toBe(3);
        expect(page.items.map(i => i.id)).toEqual(['a', 'b']);
        expect(page.nextCursor).toBe('b');
        expect(page.items[0]?.revisionCount).toBe(2);
    });

    it('findOne answers 404 for an unknown id', async () => {
        const { db, service } = build();
        db.listing.findUnique.mockResolvedValue(null);

        await expect(service.findOne('nope')).rejects.toThrow(
            NotFoundException
        );
    });

    it('revisions lists newest first and 404s for an unknown listing', async () => {
        const { db, service } = build();
        db.listing.findUnique.mockResolvedValueOnce(null);
        await expect(service.revisions('nope', {})).rejects.toThrow(
            NotFoundException
        );

        db.listing.findUnique.mockResolvedValueOnce({ id: 'l1' });
        db.listingRevision.findMany.mockResolvedValue([
            {
                id: 'r1',
                createdAt: new Date('2026-10-31T00:00:00.000Z'),
                changes: [{ field: 'price', from: 1, to: 2 }],
                editor: { id: 'u1', name: 'Sara' },
            },
        ]);

        const page = await service.revisions('l1', { limit: 20 });

        expect(db.listingRevision.findMany.mock.calls[0][0].orderBy).toEqual([
            { createdAt: 'desc' },
            { id: 'desc' },
        ]);
        expect(page).toEqual({
            items: [
                {
                    id: 'r1',
                    createdAt: new Date('2026-10-31T00:00:00.000Z'),
                    editor: { id: 'u1', name: 'Sara' },
                    changes: [{ field: 'price', from: 1, to: 2 }],
                },
            ],
            nextCursor: null,
        });
    });
});

describe('ListingNotifier', () => {
    it('sends a LISTING_UPDATE push + in-app row with the unit in the copy', async () => {
        const send = jest.fn().mockResolvedValue(undefined);
        const notifier = new ListingNotifier({
            send,
        } as unknown as NotificationsService);

        await notifier.notify('APPROVED', 'u1', 'l1', 'A1-3-2');

        const args = send.mock.calls[0];
        expect(args[0]).toBe('u1');
        expect(args[1]).toBe(NotificationType.LISTING_UPDATE);
        expect(args[4]).toContain('A1-3-2');
        expect(args[5]).toContain('A1-3-2');
        expect(args[6]).toEqual({
            type: 'LISTING_UPDATE',
            listingId: 'l1',
            status: 'APPROVED',
        });
    });

    it('swallows a send failure so the status change never fails', async () => {
        const notifier = new ListingNotifier({
            send: jest.fn().mockRejectedValue(new Error('push down')),
        } as unknown as NotificationsService);

        await expect(
            notifier.notify('EXPIRED', 'u1', 'l1', 'A1-3-2')
        ).resolves.toBeUndefined();
    });
});

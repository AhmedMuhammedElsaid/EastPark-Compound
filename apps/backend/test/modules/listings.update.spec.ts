import {
    BadRequestException,
    ConflictException,
    NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ListingStatus, ListingType, Prisma, Role } from '@prisma/client';

import { CacheService } from 'src/common/cache/services/cache.service';
import { DatabaseService } from 'src/common/database/services/database.service';
import { ListingNotifier } from 'src/modules/listings/listing.notifier';
import { ListingsService } from 'src/modules/listings/listings.service';
import { ResidentUnitsService } from 'src/modules/units/resident-units.service';

const BASE =
    'https://proj.supabase.co/storage/v1/object/public/uploads/listing-photos';
const photo = (n: number) => `${BASE}/p${n}.jpg`;

const owner = { userId: 'u1', role: Role.RESIDENT };
const stranger = { userId: 'u2', role: Role.RESIDENT };
const ALL_STATUSES = Object.values(ListingStatus);
const EDITABLE = [
    ListingStatus.PENDING,
    ListingStatus.APPROVED,
    ListingStatus.REJECTED,
];

const row = (overrides: Record<string, unknown> = {}) => ({
    id: 'l1',
    ownerId: 'u1',
    type: ListingType.SALE,
    status: ListingStatus.PENDING,
    building: 'A1',
    floor: '3',
    flatNumber: '2',
    price: new Prisma.Decimal('2500000'),
    areaSqm: 140,
    bedrooms: 3,
    bathrooms: 2,
    furnished: false,
    description: null,
    contactPhone: '01012345678',
    photos: [photo(1), photo(2)],
    rejectReason: null,
    approvedAt: null,
    expiresAt: null,
    reviewedById: null,
    createdAt: new Date('2026-10-30T10:00:00.000Z'),
    updatedAt: new Date('2026-10-30T10:00:00.000Z'),
    owner: { id: 'u1', name: 'Sara' },
    ...overrides,
});

const dto = (overrides: Record<string, unknown> = {}) =>
    ({
        type: ListingType.SALE,
        building: 'A1',
        floor: '3',
        flatNumber: '2',
        price: 2500000,
        areaSqm: 140,
        bedrooms: 3,
        bathrooms: 2,
        furnished: false,
        contactPhone: '01012345678',
        photos: [photo(1), photo(2)],
        ...overrides,
    }) as never;

function build() {
    const db = {
        listing: {
            findMany: jest.fn(),
            findUnique: jest.fn(),
            findUniqueOrThrow: jest.fn(),
            findFirst: jest.fn().mockResolvedValue(null),
            create: jest.fn(),
            updateMany: jest.fn().mockResolvedValue({ count: 1 }),
        },
        listingRevision: { create: jest.fn() },
        user: { findUnique: jest.fn() },
        $transaction: jest.fn(),
    };
    db.$transaction.mockImplementation((fn: (tx: unknown) => unknown) =>
        fn(db)
    );
    const cache = {
        get: jest.fn().mockResolvedValue(null),
        incrWithTtl: jest.fn().mockResolvedValue(1),
    };
    const notifier = { notify: jest.fn().mockResolvedValue(undefined) };
    // Default: the flat A1-3-2 belongs to the acting owner (u1).
    const units = {
        findOwner: jest.fn().mockResolvedValue({ id: 'ru1', userId: 'u1' }),
    };
    const config = {
        getOrThrow: (key: string) =>
            key === 'supabase.url' ? 'https://proj.supabase.co' : 'uploads',
    };
    const service = new ListingsService(
        db as unknown as DatabaseService,
        config as unknown as ConfigService,
        cache as unknown as CacheService,
        notifier as unknown as ListingNotifier,
        units as unknown as ResidentUnitsService
    );
    return { db, units, notifier, service };
}

describe('ListingsService update', () => {
    it.each(ALL_STATUSES)('edit from %s', async status => {
        const { db, service } = build();
        db.listing.findUnique.mockResolvedValue(row({ status }));
        db.listing.findUniqueOrThrow.mockResolvedValue(
            row({ status: ListingStatus.PENDING, price: new Prisma.Decimal(1) })
        );

        const result = service.update('l1', dto({ price: 2400000 }), owner);

        if (EDITABLE.includes(status)) {
            await expect(result).resolves.toBeDefined();
        } else {
            await expect(result).rejects.toThrow(
                new ConflictException('listing.error.invalidStatus')
            );
            expect(db.listing.updateMany).not.toHaveBeenCalled();
            expect(db.listingRevision.create).not.toHaveBeenCalled();
        }
    });

    it('sends the listing back to PENDING, clears approval/expiry/reason and writes one revision', async () => {
        const { db, service } = build();
        db.listing.findUnique.mockResolvedValue(
            row({
                status: ListingStatus.APPROVED,
                approvedAt: new Date('2026-10-30T12:00:00.000Z'),
                expiresAt: new Date('2026-12-29T12:00:00.000Z'),
            })
        );
        db.listing.findUniqueOrThrow.mockResolvedValue(row());

        await service.update('l1', dto({ price: 2400000 }), owner);

        const claim = db.listing.updateMany.mock.calls[0][0];
        expect(claim.where).toEqual({
            id: 'l1',
            status: ListingStatus.APPROVED,
        });
        expect(claim.data).toMatchObject({
            status: ListingStatus.PENDING,
            approvedAt: null,
            expiresAt: null,
            rejectReason: null,
        });
        expect(claim.data.price).toBeInstanceOf(Prisma.Decimal);

        expect(db.listingRevision.create).toHaveBeenCalledTimes(1);
        const revision = db.listingRevision.create.mock.calls[0][0].data;
        expect(revision.listingId).toBe('l1');
        expect(revision.editorId).toBe('u1');
        expect(revision.changes).toEqual([
            { field: 'price', from: 2500000, to: 2400000 },
        ]);
        expect(revision.snapshot).toMatchObject({
            price: 2500000,
            building: 'A1',
            photos: [photo(1), photo(2)],
        });
    });

    it('records photo add, remove and reorder in the revision', async () => {
        const { db, service } = build();
        db.listing.findUnique.mockResolvedValue(row());
        db.listing.findUniqueOrThrow.mockResolvedValue(row());

        await service.update('l1', dto({ photos: [photo(3), photo(1)] }), owner);
        expect(
            db.listingRevision.create.mock.calls[0][0].data.changes
        ).toEqual([
            { field: 'photos', added: [photo(3)], removed: [photo(2)] },
        ]);

        db.listingRevision.create.mockClear();
        await service.update('l1', dto({ photos: [photo(2), photo(1)] }), owner);
        expect(
            db.listingRevision.create.mock.calls[0][0].data.changes
        ).toEqual([
            { field: 'photos', added: [], removed: [], reordered: true },
        ]);
    });

    it('answers 400 noChanges for an identical body and writes nothing', async () => {
        const { db, service } = build();
        db.listing.findUnique.mockResolvedValue(row());

        await expect(service.update('l1', dto(), owner)).rejects.toThrow(
            new BadRequestException('listing.error.noChanges')
        );
        expect(db.listing.updateMany).not.toHaveBeenCalled();
        expect(db.listingRevision.create).not.toHaveBeenCalled();
    });

    it('treats a whitespace-only description on a null description as no change', async () => {
        const { db, service } = build();
        db.listing.findUnique.mockResolvedValue(row());

        await expect(
            service.update('l1', dto({ description: '   ' }), owner)
        ).rejects.toThrow(new BadRequestException('listing.error.noChanges'));
    });

    it('answers 404 for a stranger and a missing listing', async () => {
        const { db, service } = build();
        db.listing.findUnique.mockResolvedValueOnce(row());
        await expect(
            service.update('l1', dto({ price: 1 }), stranger)
        ).rejects.toThrow(new NotFoundException('listing.error.notFound'));

        db.listing.findUnique.mockResolvedValueOnce(null);
        await expect(
            service.update('nope', dto({ price: 1 }), owner)
        ).rejects.toThrow(NotFoundException);
        expect(db.listing.updateMany).not.toHaveBeenCalled();
    });

    it('rejects a NEW photo URL outside our bucket but keeps stored ones', async () => {
        const { db, service } = build();
        const legacy = 'https://old-host.example.com/legacy.jpg';
        db.listing.findUnique.mockResolvedValue(row({ photos: [legacy] }));
        db.listing.findUniqueOrThrow.mockResolvedValue(row());

        await expect(
            service.update(
                'l1',
                dto({ photos: [legacy, 'https://evil.example.com/x.jpg'] }),
                owner
            )
        ).rejects.toThrow(new BadRequestException('file.error.urlNotStored'));

        await expect(
            service.update('l1', dto({ photos: [legacy, photo(5)] }), owner)
        ).resolves.toBeDefined();
    });

    it('re-checks the flat when it changes and refuses a taken one', async () => {
        const { db, service } = build();
        db.listing.findUnique.mockResolvedValue(row());
        db.listing.findFirst.mockResolvedValue({ id: 'other' });

        await expect(
            service.update('l1', dto({ flatNumber: '4' }), owner)
        ).rejects.toThrow(
            new ConflictException('listing.error.unitAlreadyListed')
        );
        expect(db.listing.findFirst.mock.calls[0][0].where).toMatchObject({
            flatNumber: '4',
            id: { not: 'l1' },
        });
        expect(db.listing.updateMany).not.toHaveBeenCalled();
    });

    it('an edit that moves to a flat the caller does not own gets 400 unitNotOwned', async () => {
        const { db, units, service } = build();
        db.listing.findUnique.mockResolvedValue(row());
        units.findOwner.mockResolvedValue({ id: 'ru9', userId: 'u2' });

        await expect(
            service.update('l1', dto({ flatNumber: '4' }), owner)
        ).rejects.toThrow(
            new BadRequestException('listing.error.unitNotOwned')
        );
        expect(units.findOwner).toHaveBeenCalledWith(
            expect.objectContaining({ flatNumber: '4' })
        );
        expect(db.listing.updateMany).not.toHaveBeenCalled();
    });

    it('an edit that keeps a flat since removed from the account gets 400', async () => {
        const { db, units, service } = build();
        db.listing.findUnique.mockResolvedValue(row());
        units.findOwner.mockResolvedValue(null);
        db.user.findUnique.mockResolvedValue({
            unitNumber: null,
            _count: { residentUnits: 0 },
        });

        await expect(
            service.update('l1', dto({ price: 2400000 }), owner)
        ).rejects.toThrow(
            new BadRequestException('listing.error.unitNotOwned')
        );
    });

    it('legacy account: an edit passes when unitNumber matches the flat label', async () => {
        const { db, units, service } = build();
        db.listing.findUnique.mockResolvedValue(row());
        db.listing.findUniqueOrThrow.mockResolvedValue(row());
        units.findOwner.mockResolvedValue(null);
        db.user.findUnique.mockResolvedValue({
            unitNumber: 'A1-3-2',
            _count: { residentUnits: 0 },
        });

        await expect(
            service.update('l1', dto({ price: 2400000 }), owner)
        ).resolves.toBeDefined();
    });

    it('does not re-check the flat for an edit that keeps it (PENDING)', async () => {
        const { db, service } = build();
        db.listing.findUnique.mockResolvedValue(row());
        db.listing.findUniqueOrThrow.mockResolvedValue(row());

        await service.update('l1', dto({ price: 2400000 }), owner);

        expect(db.listing.findFirst).not.toHaveBeenCalled();
    });

    it('re-acquires the flat when editing a REJECTED listing', async () => {
        const { db, service } = build();
        db.listing.findUnique.mockResolvedValue(
            row({ status: ListingStatus.REJECTED, rejectReason: 'Blurry' })
        );
        db.listing.findFirst.mockResolvedValue({ id: 'newer' });

        await expect(
            service.update('l1', dto({ price: 2400000 }), owner)
        ).rejects.toThrow(
            new ConflictException('listing.error.unitAlreadyListed')
        );
    });

    it('maps a unique-index race during the edit to 409', async () => {
        const { db, service } = build();
        db.listing.findUnique.mockResolvedValue(row());
        db.listing.updateMany.mockRejectedValue({ code: 'P2002' });

        await expect(
            service.update('l1', dto({ flatNumber: '4' }), owner)
        ).rejects.toThrow(
            new ConflictException('listing.error.unitAlreadyListed')
        );
    });

    it('answers 409 and writes no revision when the status changed under us', async () => {
        const { db, service } = build();
        db.listing.findUnique.mockResolvedValue(row());
        db.listing.updateMany.mockResolvedValue({ count: 0 });

        await expect(
            service.update('l1', dto({ price: 2400000 }), owner)
        ).rejects.toThrow(
            new ConflictException('listing.error.invalidStatus')
        );
        expect(db.listingRevision.create).not.toHaveBeenCalled();
    });
});

describe('ListingsService expireDue (hourly cron)', () => {
    const now = new Date('2026-12-30T00:00:00.000Z');
    const due = (id: string, ownerId = 'u1') => ({
        id,
        ownerId,
        building: 'A1',
        floor: '3',
        flatNumber: '2',
    });

    it('selects only APPROVED listings whose expiry has passed', async () => {
        const { db, service } = build();
        db.listing.findMany.mockResolvedValue([]);

        const count = await service.expireDue(now);

        expect(count).toBe(0);
        expect(db.listing.findMany.mock.calls[0][0].where).toEqual({
            status: ListingStatus.APPROVED,
            expiresAt: { lte: now },
        });
    });

    it('flips each due listing to EXPIRED and notifies its owner', async () => {
        const { db, notifier, service } = build();
        db.listing.findMany.mockResolvedValue([due('a'), due('b', 'u9')]);

        const count = await service.expireDue(now);

        expect(count).toBe(2);
        expect(db.listing.updateMany).toHaveBeenCalledTimes(2);
        expect(db.listing.updateMany.mock.calls[0][0]).toEqual({
            where: {
                id: 'a',
                status: ListingStatus.APPROVED,
                expiresAt: { lte: now },
            },
            data: { status: ListingStatus.EXPIRED },
        });
        expect(notifier.notify).toHaveBeenCalledWith(
            'EXPIRED',
            'u1',
            'a',
            'A1-3-2'
        );
        expect(notifier.notify).toHaveBeenCalledWith(
            'EXPIRED',
            'u9',
            'b',
            'A1-3-2'
        );
    });

    it('skips a listing the owner renewed or closed since the read', async () => {
        const { db, notifier, service } = build();
        db.listing.findMany.mockResolvedValue([due('a'), due('b')]);
        db.listing.updateMany
            .mockResolvedValueOnce({ count: 0 })
            .mockResolvedValueOnce({ count: 1 });

        const count = await service.expireDue(now);

        expect(count).toBe(1);
        expect(notifier.notify).toHaveBeenCalledTimes(1);
        expect(notifier.notify).toHaveBeenCalledWith(
            'EXPIRED',
            'u1',
            'b',
            'A1-3-2'
        );
    });

    it('is a no-op when nothing is due', async () => {
        const { db, notifier, service } = build();
        db.listing.findMany.mockResolvedValue([]);

        await service.expireDue(now);

        expect(db.listing.updateMany).not.toHaveBeenCalled();
        expect(notifier.notify).not.toHaveBeenCalled();
    });
});

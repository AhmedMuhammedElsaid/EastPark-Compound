import {
    BadRequestException,
    ConflictException,
    HttpException,
    HttpStatus,
    NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ListingStatus, ListingType, Prisma, Role } from '@prisma/client';

import { CacheService } from 'src/common/cache/services/cache.service';
import { DatabaseService } from 'src/common/database/services/database.service';
import { LISTING_VALIDITY_MS } from 'src/modules/listings/listing.constants';
import { ListingNotifier } from 'src/modules/listings/listing.notifier';
import { ListingsService } from 'src/modules/listings/listings.service';
import { ResidentUnitsService } from 'src/modules/units/resident-units.service';
import { asOwnership, mockFlatOwnership } from 'test/mocks/flat-ownership.mock';

const BASE =
    'https://proj.supabase.co/storage/v1/object/public/uploads/listing-photos';
const photo = (n: number) => `${BASE}/p${n}.jpg`;

const owner = { userId: 'u1', role: Role.RESIDENT };
const stranger = { userId: 'u2', role: Role.RESIDENT };
const ALL_STATUSES = Object.values(ListingStatus);

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
    photos: [photo(1)],
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
        photos: [photo(1)],
        ...overrides,
    }) as never;

function build() {
    const db = {
        listing: {
            findMany: jest.fn(),
            findUnique: jest.fn(),
            findUniqueOrThrow: jest.fn(),
            findFirst: jest.fn(),
            create: jest.fn(),
            updateMany: jest.fn(),
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
    const ownership = mockFlatOwnership();
    const service = new ListingsService(
        db as unknown as DatabaseService,
        config as unknown as ConfigService,
        cache as unknown as CacheService,
        notifier as unknown as ListingNotifier,
        units as unknown as ResidentUnitsService,
        asOwnership(ownership)
    );
    return { db, units, cache, notifier, service, ownership };
}

describe('ListingsService create', () => {
    it('creates a PENDING listing for the caller and returns the owner view', async () => {
        const { db, service } = build();
        db.listing.findFirst.mockResolvedValue(null);
        db.listing.create.mockResolvedValue(row());

        const out = await service.create(dto(), owner);

        const data = db.listing.create.mock.calls[0][0].data;
        expect(data.status).toBe(ListingStatus.PENDING);
        expect(data.ownerId).toBe('u1');
        expect(data.price).toBeInstanceOf(Prisma.Decimal);
        expect(out.status).toBe(ListingStatus.PENDING);
        expect(out.price).toBe(2500000);
        expect(out.unitLabel).toBe('A1-3-2');
        expect(out).toHaveProperty('rejectReason', null);
        expect(out.owner).toEqual({ id: 'u1', name: 'Sara' });
    });

    it('sets the informational flatId from the normalised key', async () => {
        const { db, service, ownership } = build();
        db.listing.findFirst.mockResolvedValue(null);
        db.listing.create.mockResolvedValue(row());
        ownership.resolveFlatId.mockResolvedValue('flat-a132');

        await service.create(dto(), owner);

        expect(ownership.resolveFlatId).toHaveBeenCalledWith(
            db,
            expect.objectContaining({ building: 'A1', floor: '3', flatNumber: '2' })
        );
        expect(db.listing.create.mock.calls[0][0].data.flatId).toBe('flat-a132');
    });

    it('an unknown key (strict off) stores flatId null', async () => {
        const { db, service } = build();
        db.listing.findFirst.mockResolvedValue(null);
        db.listing.create.mockResolvedValue(row());
        await service.create(dto(), owner);
        expect(db.listing.create.mock.calls[0][0].data.flatId).toBeNull();
    });

    it('refuses a flat that already has a PENDING/APPROVED listing (pre-check)', async () => {
        const { db, service } = build();
        db.listing.findFirst.mockResolvedValue({ id: 'other' });

        await expect(service.create(dto(), owner)).rejects.toThrow(
            new ConflictException('listing.error.unitAlreadyListed')
        );
        expect(db.listing.create).not.toHaveBeenCalled();
        expect(db.listing.findFirst.mock.calls[0][0].where).toMatchObject({
            building: 'A1',
            floor: '3',
            flatNumber: '2',
            status: { in: [ListingStatus.PENDING, ListingStatus.APPROVED] },
        });
    });

    it('refuses a flat owned by another account with 400 unitNotOwned', async () => {
        const { db, units, service } = build();
        units.findOwner.mockResolvedValue({ id: 'ru9', userId: 'u2' });

        await expect(service.create(dto(), owner)).rejects.toThrow(
            new BadRequestException('listing.error.unitNotOwned')
        );
        expect(db.user.findUnique).not.toHaveBeenCalled();
        expect(db.listing.create).not.toHaveBeenCalled();
    });

    it('legacy account (no resident_units rows): the unitNumber label match passes', async () => {
        const { db, units, service } = build();
        units.findOwner.mockResolvedValue(null);
        db.user.findUnique.mockResolvedValue({
            unitNumber: ' A1-3-2 ',
            _count: { residentUnits: 0 },
        });
        db.listing.findFirst.mockResolvedValue(null);
        db.listing.create.mockResolvedValue(row());

        await expect(service.create(dto(), owner)).resolves.toBeDefined();
    });

    it('legacy account with a different unitNumber label gets 400', async () => {
        const { db, units, service } = build();
        units.findOwner.mockResolvedValue(null);
        db.user.findUnique.mockResolvedValue({
            unitNumber: 'B2-1-1',
            _count: { residentUnits: 0 },
        });

        await expect(service.create(dto(), owner)).rejects.toThrow(
            new BadRequestException('listing.error.unitNotOwned')
        );
        expect(db.listing.create).not.toHaveBeenCalled();
    });

    it('an unowned flat is refused when the account already has resident_units rows, even if unitNumber matches', async () => {
        const { db, units, service } = build();
        units.findOwner.mockResolvedValue(null);
        db.user.findUnique.mockResolvedValue({
            unitNumber: 'A1-3-2',
            _count: { residentUnits: 1 },
        });

        await expect(service.create(dto(), owner)).rejects.toThrow(
            new BadRequestException('listing.error.unitNotOwned')
        );
    });

    it('maps a unique-index race (P2002) to 409 unitAlreadyListed', async () => {
        const { db, service } = build();
        db.listing.findFirst.mockResolvedValue(null);
        db.listing.create.mockRejectedValue({ code: 'P2002' });

        await expect(service.create(dto(), owner)).rejects.toThrow(
            new ConflictException('listing.error.unitAlreadyListed')
        );
    });

    it('lets any other database error through unmapped', async () => {
        const { db, service } = build();
        db.listing.findFirst.mockResolvedValue(null);
        const boom = new Error('connection lost');
        db.listing.create.mockRejectedValue(boom);

        await expect(service.create(dto(), owner)).rejects.toBe(boom);
    });

    it('rejects a photo URL outside our bucket before touching the database', async () => {
        const { db, service } = build();

        await expect(
            service.create(
                dto({ photos: ['https://evil.example.com/a.jpg'] }),
                owner
            )
        ).rejects.toThrow(new BadRequestException('file.error.urlNotStored'));
        expect(db.listing.findFirst).not.toHaveBeenCalled();
        expect(db.listing.create).not.toHaveBeenCalled();
    });

    it('rejects 0 and 9 photos with photosRequired', async () => {
        const { service } = build();
        const nine = Array.from({ length: 9 }, (_, i) => photo(i));

        for (const photos of [[], nine]) {
            await expect(service.create(dto({ photos }), owner)).rejects.toThrow(
                new BadRequestException('listing.error.photosRequired')
            );
        }
    });

    it('allows 5 creates per hour and answers 429 once 5 have succeeded', async () => {
        const { db, cache, service } = build();
        db.listing.findFirst.mockResolvedValue(null);
        db.listing.create.mockResolvedValue(row());

        cache.get.mockResolvedValue(4);
        await expect(service.create(dto(), owner)).resolves.toBeDefined();
        expect(cache.get).toHaveBeenCalledWith('listing-create:u1');
        expect(cache.incrWithTtl).toHaveBeenCalledWith(
            'listing-create:u1',
            3600
        );

        cache.incrWithTtl.mockClear();
        db.listing.create.mockClear();
        cache.get.mockResolvedValue(5);
        const error = await service.create(dto(), owner).catch(e => e);
        expect(error).toBeInstanceOf(HttpException);
        expect(error.getStatus()).toBe(HttpStatus.TOO_MANY_REQUESTS);
        expect(error.message).toBe('listing.error.tooManyCreated');
        expect(db.listing.create).not.toHaveBeenCalled();
        expect(cache.incrWithTtl).not.toHaveBeenCalled();
    });

    it('failed attempts (409, 400, db error) do not count toward the cap', async () => {
        const { db, cache, service } = build();

        db.listing.findFirst.mockResolvedValueOnce({ id: 'other' });
        await expect(service.create(dto(), owner)).rejects.toBeInstanceOf(
            ConflictException
        );

        await expect(
            service.create(dto({ photos: [] }), owner)
        ).rejects.toBeInstanceOf(BadRequestException);

        db.listing.findFirst.mockResolvedValueOnce(null);
        db.listing.create.mockRejectedValueOnce({ code: 'P2002' });
        await expect(service.create(dto(), owner)).rejects.toBeInstanceOf(
            ConflictException
        );

        expect(cache.incrWithTtl).not.toHaveBeenCalled();
    });

    it('stores the building upper-cased and trimmed', async () => {
        const { db, service } = build();
        db.listing.findFirst.mockResolvedValue(null);
        db.listing.create.mockResolvedValue(row());

        await service.create(dto({ building: ' a1 ' }), owner);

        expect(db.listing.create.mock.calls[0][0].data.building).toBe('A1');
        expect(db.listing.findFirst.mock.calls[0][0].where.building).toBe('A1');
    });
});

describe('ListingsService browse / mine / findOne', () => {
    it('browse queries only APPROVED, unexpired listings of live owners', async () => {
        const { db, service } = build();
        db.listing.findMany.mockResolvedValue([]);

        await service.browse({ type: ListingType.RENT, limit: 10 });

        const args = db.listing.findMany.mock.calls[0][0];
        expect(args.where).toMatchObject({
            status: ListingStatus.APPROVED,
            expiresAt: { gt: expect.any(Date) },
            owner: { deletedAt: null },
            type: ListingType.RENT,
        });
        expect(args.take).toBe(11);
        expect(args.orderBy).toEqual([{ approvedAt: 'desc' }, { id: 'desc' }]);
    });

    it('browse pages with the last returned row as the cursor and hides owner-only fields', async () => {
        const { db, service } = build();
        db.listing.findMany.mockResolvedValue([
            row({ id: 'a', rejectReason: 'secret' }),
            row({ id: 'b' }),
            row({ id: 'c' }),
        ]);

        const page = await service.browse({ limit: 2 });

        expect(page.items.map(i => i.id)).toEqual(['a', 'b']);
        expect(page.nextCursor).toBe('b');
        expect(page.items[0]).not.toHaveProperty('rejectReason');
    });

    it('browse returns nextCursor null on the last page and resumes after a cursor', async () => {
        const { db, service } = build();
        db.listing.findMany.mockResolvedValue([row({ id: 'z' })]);

        const page = await service.browse({ limit: 5, cursor: 'b' });

        expect(page.nextCursor).toBeNull();
        expect(db.listing.findMany.mock.calls[0][0]).toMatchObject({
            skip: 1,
            cursor: { id: 'b' },
        });
    });

    it('mine lists only the caller listings, filtered by status when given', async () => {
        const { db, service } = build();
        db.listing.findMany.mockResolvedValue([
            row({ status: ListingStatus.REJECTED, rejectReason: 'Blurry' }),
        ]);

        const page = await service.mine(owner, {
            status: ListingStatus.REJECTED,
        });

        expect(db.listing.findMany.mock.calls[0][0].where).toEqual({
            ownerId: 'u1',
            status: ListingStatus.REJECTED,
        });
        expect(page.items[0]).toHaveProperty('rejectReason', 'Blurry');
    });

    it('findOne gives the owner their own listing in any status', async () => {
        const { db, service } = build();
        db.listing.findUnique.mockResolvedValue({
            ...row({ status: ListingStatus.WITHDRAWN }),
            owner: { id: 'u1', name: 'Sara', deletedAt: null },
        });

        const out = await service.findOne('l1', owner);

        expect(out.status).toBe(ListingStatus.WITHDRAWN);
        expect(out).toHaveProperty('rejectReason');
    });

    it('findOne answers 404 for a stranger on every non-visible case', async () => {
        const { db, service } = build();
        const past = new Date(Date.now() - 1000);
        const future = new Date(Date.now() + 86_400_000);
        const hidden = [
            row({ status: ListingStatus.PENDING }),
            row({ status: ListingStatus.REJECTED }),
            row({ status: ListingStatus.SOLD, expiresAt: future }),
            row({ status: ListingStatus.APPROVED, expiresAt: past }),
            row({ status: ListingStatus.APPROVED, expiresAt: null }),
            row({
                status: ListingStatus.APPROVED,
                expiresAt: future,
                owner: { id: 'u1', name: 'Sara', deletedAt: new Date() },
            }),
        ];

        for (const candidate of hidden) {
            db.listing.findUnique.mockResolvedValueOnce({
                owner: { id: 'u1', name: 'Sara', deletedAt: null },
                ...candidate,
            });
            await expect(service.findOne('l1', stranger)).rejects.toThrow(
                new NotFoundException('listing.error.notFound')
            );
        }

        db.listing.findUnique.mockResolvedValueOnce(null);
        await expect(service.findOne('nope', stranger)).rejects.toThrow(
            NotFoundException
        );
    });

    it('findOne shows a stranger an approved, unexpired listing without owner-only fields', async () => {
        const { db, service } = build();
        db.listing.findUnique.mockResolvedValue({
            ...row({
                status: ListingStatus.APPROVED,
                expiresAt: new Date(Date.now() + 86_400_000),
                rejectReason: 'old',
            }),
            owner: { id: 'u1', name: 'Sara', deletedAt: null },
        });

        const out = await service.findOne('l1', stranger);

        expect(out.id).toBe('l1');
        expect(out).not.toHaveProperty('rejectReason');
        expect(out.owner).toEqual({ id: 'u1', name: 'Sara' });
    });
});

describe('ListingsService owner status machine', () => {
    const run = (
        action: 'renew' | 'close' | 'withdraw',
        status: ListingStatus,
        type: ListingType = ListingType.SALE
    ) => {
        const ctx = build();
        ctx.db.listing.findUnique.mockResolvedValue(row({ status, type }));
        ctx.db.listing.updateMany.mockResolvedValue({ count: 1 });
        ctx.db.listing.findUniqueOrThrow.mockResolvedValue(
            row({ status, type })
        );
        return { ...ctx, result: ctx.service[action]('l1', owner) };
    };

    const ALLOWED: Record<'renew' | 'close' | 'withdraw', ListingStatus[]> = {
        renew: [ListingStatus.APPROVED],
        close: [ListingStatus.APPROVED],
        withdraw: [
            ListingStatus.PENDING,
            ListingStatus.APPROVED,
            ListingStatus.REJECTED,
        ],
    };

    for (const action of ['renew', 'close', 'withdraw'] as const) {
        it.each(ALL_STATUSES)(`${action} from %s`, async status => {
            const { db, result } = run(action, status);

            if (ALLOWED[action].includes(status)) {
                await expect(result).resolves.toBeDefined();
                expect(db.listing.updateMany).toHaveBeenCalledTimes(1);
                expect(
                    db.listing.updateMany.mock.calls[0][0].where
                ).toMatchObject({ id: 'l1' });
            } else {
                await expect(result).rejects.toThrow(
                    new ConflictException('listing.error.invalidStatus')
                );
                expect(db.listing.updateMany).not.toHaveBeenCalled();
            }
        });
    }

    it.each(['renew', 'close'] as const)(
        '%s only matches a listing that has not expired yet',
        async action => {
            const { db, result } = run(action, ListingStatus.APPROVED);
            await result;
            expect(db.listing.updateMany.mock.calls[0][0].where).toEqual({
                id: 'l1',
                status: { in: [ListingStatus.APPROVED] },
                expiresAt: { gt: expect.any(Date) },
            });
        }
    );

    it.each(['renew', 'close'] as const)(
        '%s of an expired-but-not-yet-cronned listing answers 409',
        async action => {
            const { db, service } = build();
            db.listing.findUnique.mockResolvedValue(
                row({
                    status: ListingStatus.APPROVED,
                    expiresAt: new Date(Date.now() - 1000),
                })
            );
            // The DB no longer matches expiresAt > now.
            db.listing.updateMany.mockResolvedValue({ count: 0 });

            await expect(service[action]('l1', owner)).rejects.toThrow(
                new ConflictException('listing.error.invalidStatus')
            );
        }
    );

    it('withdraw does not filter on expiresAt', async () => {
        const { db, result } = run('withdraw', ListingStatus.APPROVED);
        await result;
        expect(
            db.listing.updateMany.mock.calls[0][0].where
        ).not.toHaveProperty('expiresAt');
    });

    it('renew extends the expiry by 60 days from now', async () => {
        const fixed = new Date('2026-11-01T00:00:00.000Z').getTime();
        const spy = jest.spyOn(Date, 'now').mockReturnValue(fixed);
        try {
            const { db, result } = run('renew', ListingStatus.APPROVED);
            await result;
            const data = db.listing.updateMany.mock.calls[0][0].data;
            expect(data.expiresAt.getTime()).toBe(fixed + LISTING_VALIDITY_MS);
            expect(LISTING_VALIDITY_MS).toBe(60 * 24 * 60 * 60 * 1000);
            expect(data.status).toBeUndefined();
        } finally {
            spy.mockRestore();
        }
    });

    it('close maps SALE to SOLD and RENT to RENTED', async () => {
        const sale = run('close', ListingStatus.APPROVED, ListingType.SALE);
        await sale.result;
        expect(sale.db.listing.updateMany.mock.calls[0][0].data).toEqual({
            status: ListingStatus.SOLD,
        });

        const rent = run('close', ListingStatus.APPROVED, ListingType.RENT);
        await rent.result;
        expect(rent.db.listing.updateMany.mock.calls[0][0].data).toEqual({
            status: ListingStatus.RENTED,
        });
    });

    it('withdraw sets WITHDRAWN', async () => {
        const { db, result } = run('withdraw', ListingStatus.REJECTED);
        await result;
        expect(db.listing.updateMany.mock.calls[0][0].data).toEqual({
            status: ListingStatus.WITHDRAWN,
        });
    });

    it('answers 409 when a concurrent change wins the compare-and-set', async () => {
        const { db, service } = build();
        db.listing.findUnique.mockResolvedValue(
            row({ status: ListingStatus.APPROVED })
        );
        db.listing.updateMany.mockResolvedValue({ count: 0 });

        await expect(service.close('l1', owner)).rejects.toThrow(
            new ConflictException('listing.error.invalidStatus')
        );
        expect(db.listing.findUniqueOrThrow).not.toHaveBeenCalled();
    });

    it.each(['renew', 'close', 'withdraw'] as const)(
        '%s answers 404 for a stranger and for a missing listing',
        async action => {
            const { db, service } = build();
            db.listing.findUnique.mockResolvedValueOnce(
                row({ status: ListingStatus.APPROVED })
            );
            await expect(service[action]('l1', stranger)).rejects.toThrow(
                new NotFoundException('listing.error.notFound')
            );

            db.listing.findUnique.mockResolvedValueOnce(null);
            await expect(service[action]('nope', owner)).rejects.toThrow(
                NotFoundException
            );
            expect(db.listing.updateMany).not.toHaveBeenCalled();
        }
    );
});

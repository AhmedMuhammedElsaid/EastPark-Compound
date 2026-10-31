import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ListingType, Prisma, Role } from '@prisma/client';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';

import { ENUM_FILE_STORE } from 'src/common/file/enums/files.enum';
import {
    IMAGE_UPLOAD_PURPOSES,
    DEFAULT_IMAGE_PURPOSE,
    resolveUploadStore,
} from 'src/modules/uploads/upload-purpose';
import { ListingRejectDto } from 'src/modules/listings/dtos/request/listing.reject.dto';
import { ListingUpsertDto } from 'src/modules/listings/dtos/request/listing.upsert.dto';
import {
    diffListing,
    ListingFields,
    normalizeFields,
    toFields,
} from 'src/modules/listings/listing.diff';
import { assertListingPhotos } from 'src/modules/listings/listing.photos';
import { listingSearchFilter } from 'src/modules/listings/listings.admin.service';

const BASE = 'https://proj.supabase.co/storage/v1/object/public/uploads/listing-photos';
const photo = (n: number) => `${BASE}/p${n}.jpg`;

const config = {
    getOrThrow: (key: string) =>
        key === 'supabase.url' ? 'https://proj.supabase.co' : 'uploads',
} as unknown as ConfigService;

const fields = (overrides: Partial<ListingFields> = {}): ListingFields => ({
    type: ListingType.SALE,
    building: 'A1',
    floor: '3',
    flatNumber: '2',
    price: 2500000,
    areaSqm: 140,
    bedrooms: 3,
    bathrooms: 2,
    furnished: false,
    description: null,
    contactPhone: '01012345678',
    photos: [photo(1), photo(2)],
    ...overrides,
});

const body = (overrides: Record<string, unknown> = {}) => ({
    type: 'SALE',
    building: ' A1 ',
    floor: '3',
    flatNumber: '2',
    price: 2500000,
    areaSqm: 140,
    bedrooms: 3,
    bathrooms: 2,
    furnished: false,
    description: '  Nice flat  ',
    contactPhone: '010 1234 5678',
    photos: [photo(1)],
    ...overrides,
});

async function errorsFor(raw: Record<string, unknown>): Promise<string[]> {
    const dto = plainToInstance(ListingUpsertDto, raw);
    const errors = await validate(dto, {
        whitelist: true,
        forbidNonWhitelisted: true,
    });
    return errors.map(e => e.property);
}

describe('diffListing', () => {
    it('is empty for a no-op edit', () => {
        expect(diffListing(fields(), fields())).toEqual([]);
    });

    it('reports only the scalar fields that changed', () => {
        const changes = diffListing(
            fields(),
            fields({ price: 2400000, furnished: true })
        );
        expect(changes).toEqual([
            { field: 'price', from: 2500000, to: 2400000 },
            { field: 'furnished', from: false, to: true },
        ]);
    });

    it('records a description change to and from null', () => {
        expect(
            diffListing(fields(), fields({ description: 'Sunny' }))
        ).toEqual([{ field: 'description', from: null, to: 'Sunny' }]);
    });

    it('reports added and removed photos without a reordered flag', () => {
        const changes = diffListing(
            fields({ photos: [photo(1), photo(2)] }),
            fields({ photos: [photo(1), photo(3)] })
        );
        expect(changes).toEqual([
            { field: 'photos', added: [photo(3)], removed: [photo(2)] },
        ]);
    });

    it('counts an order-only change as a change with reordered: true', () => {
        const changes = diffListing(
            fields({ photos: [photo(1), photo(2)] }),
            fields({ photos: [photo(2), photo(1)] })
        );
        expect(changes).toEqual([
            { field: 'photos', added: [], removed: [], reordered: true },
        ]);
    });

    it('does not flag a reorder when only a removal shifts positions', () => {
        const changes = diffListing(
            fields({ photos: [photo(1), photo(2), photo(3)] }),
            fields({ photos: [photo(1), photo(3)] })
        );
        expect(changes).toEqual([
            { field: 'photos', added: [], removed: [photo(2)] },
        ]);
    });

    it('flags a reorder that comes with an add', () => {
        const changes = diffListing(
            fields({ photos: [photo(1), photo(2)] }),
            fields({ photos: [photo(2), photo(1), photo(3)] })
        );
        expect(changes).toEqual([
            {
                field: 'photos',
                added: [photo(3)],
                removed: [],
                reordered: true,
            },
        ]);
    });
});

describe('normalizeFields / toFields', () => {
    it('trims text, maps an empty description to null and rounds the price', () => {
        const out = normalizeFields({
            ...(body() as never),
            description: '   ',
            price: 100.004,
        });
        expect(out.building).toBe('A1');
        expect(out.description).toBeNull();
        expect(out.price).toBe(100);
    });

    it('reads a stored Decimal price back as a number', () => {
        const out = toFields({
            ...fields(),
            price: new Prisma.Decimal('2500000.50'),
        });
        expect(out.price).toBe(2500000.5);
    });
});

describe('assertListingPhotos', () => {
    it('rejects 0 photos and more than 8 with listing.error.photosRequired', () => {
        expect(() => assertListingPhotos(config, [])).toThrow(
            new BadRequestException('listing.error.photosRequired')
        );
        const nine = Array.from({ length: 9 }, (_, i) => photo(i));
        expect(() => assertListingPhotos(config, nine)).toThrow(
            new BadRequestException('listing.error.photosRequired')
        );
    });

    it('accepts 1 and 8 stored photos', () => {
        expect(() => assertListingPhotos(config, [photo(1)])).not.toThrow();
        const eight = Array.from({ length: 8 }, (_, i) => photo(i));
        expect(() => assertListingPhotos(config, eight)).not.toThrow();
    });

    it('rejects a URL outside our bucket with file.error.urlNotStored', () => {
        expect(() =>
            assertListingPhotos(config, ['https://evil.example.com/a.jpg'])
        ).toThrow(new BadRequestException('file.error.urlNotStored'));
        expect(() =>
            assertListingPhotos(config, [
                'https://proj.supabase.co/storage/v1/object/public/other/x.jpg',
            ])
        ).toThrow(new BadRequestException('file.error.urlNotStored'));
    });

    it('accepts unchanged stored URLs on edit without re-validating them', () => {
        const legacy = 'https://old-host.example.com/legacy.jpg';
        expect(() =>
            assertListingPhotos(config, [legacy, photo(1)], [legacy])
        ).not.toThrow();
        expect(() =>
            assertListingPhotos(config, [legacy, 'https://evil.example.com/b.jpg'], [legacy])
        ).toThrow(new BadRequestException('file.error.urlNotStored'));
    });
});

describe('upload purpose "listing"', () => {
    const resolve = (role: Role) =>
        resolveUploadStore(
            IMAGE_UPLOAD_PURPOSES,
            'listing',
            DEFAULT_IMAGE_PURPOSE,
            role
        );

    it('stores into listing-photos for RESIDENT, ADMIN and SUPER_ADMIN', () => {
        for (const role of [Role.RESIDENT, Role.ADMIN, Role.SUPER_ADMIN]) {
            expect(resolve(role)).toBe(ENUM_FILE_STORE.LISTING_PHOTOS);
        }
        expect(ENUM_FILE_STORE.LISTING_PHOTOS).toBe('listing-photos');
    });

    it('forbids a merchant', () => {
        expect(() => resolve(Role.MERCHANT)).toThrow(ForbiddenException);
    });
});

describe('ListingUpsertDto validation', () => {
    it('accepts a valid body (and normalises phone, building, description)', async () => {
        const dto = plainToInstance(ListingUpsertDto, body());
        expect(await validate(dto)).toEqual([]);
        expect(dto.building).toBe('A1');
        expect(dto.contactPhone).toBe('01012345678');
        expect(dto.description).toBe('Nice flat');
    });

    it.each([
        ['type', { type: 'LEASE' }],
        ['building', { building: '   ' }],
        ['building', { building: 'ABCDEFGHIJK' }],
        ['floor', { floor: '12' }],
        ['flatNumber', { flatNumber: '6' }],
        ['price', { price: 0 }],
        ['price', { price: 1_000_000_001 }],
        ['price', { price: 10.123 }],
        ['areaSqm', { areaSqm: 19 }],
        ['areaSqm', { areaSqm: 1001 }],
        ['areaSqm', { areaSqm: 50.5 }],
        ['bedrooms', { bedrooms: -1 }],
        ['bedrooms', { bedrooms: 11 }],
        ['bathrooms', { bathrooms: 0 }],
        ['furnished', { furnished: 'yes' }],
        ['description', { description: 'x'.repeat(2001) }],
        ['contactPhone', { contactPhone: '12345' }],
        ['photos', { photos: [photo(1), photo(1)] }],
        ['photos', { photos: ['not a url'] }],
    ])('rejects an invalid %s', async (property, override) => {
        expect(await errorsFor(body(override))).toContain(property);
    });

    it('accepts the boundary values', async () => {
        expect(
            await errorsFor(
                body({
                    floor: 'G',
                    price: 0.01,
                    areaSqm: 20,
                    bedrooms: 0,
                    bathrooms: 1,
                    description: undefined,
                })
            )
        ).toEqual([]);
        expect(
            await errorsFor(
                body({ floor: '11', price: 1_000_000_000, areaSqm: 1000 })
            )
        ).toEqual([]);
    });

    it('rejects unknown fields (forbidNonWhitelisted)', async () => {
        expect(await errorsFor(body({ status: 'APPROVED' }))).toContain(
            'status'
        );
    });
});

describe('ListingRejectDto', () => {
    it('trims and requires 3-500 chars', async () => {
        const ok = plainToInstance(ListingRejectDto, { reason: '  Blurry  ' });
        expect(await validate(ok)).toEqual([]);
        expect(ok.reason).toBe('Blurry');

        expect(
            (await validate(plainToInstance(ListingRejectDto, { reason: ' ab ' })))
                .length
        ).toBe(1);
        expect(
            (
                await validate(
                    plainToInstance(ListingRejectDto, { reason: 'x'.repeat(501) })
                )
            ).length
        ).toBe(1);
    });
});

describe('listingSearchFilter', () => {
    it('matches building and owner name case-insensitively', () => {
        const filter = listingSearchFilter('sara');
        expect(filter).toEqual([
            { building: { contains: 'sara', mode: 'insensitive' } },
            { owner: { name: { contains: 'sara', mode: 'insensitive' } } },
        ]);
    });

    it('adds an exact unit-label branch for building-floor-flat', () => {
        const filter = listingSearchFilter('a1-3-2');
        expect(filter).toContainEqual({
            building: { equals: 'a1', mode: 'insensitive' },
            floor: { equals: '3', mode: 'insensitive' },
            flatNumber: { equals: '2', mode: 'insensitive' },
        });
    });
});

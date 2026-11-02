import { BadRequestException, ConflictException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { OwnershipClosedReason } from '@prisma/client';

import {
    cairoDate,
    cairoDateString,
    cairoToday,
    OWNERSHIP_SENTINEL_DATE,
} from 'src/common/finance/cairo-date';
import {
    FINANCE_GO_LIVE_KEY,
    FlatOwnershipService,
    OwnershipClient,
} from 'src/common/finance/flat-ownership.service';

// ─── In-memory store: flats, units, periods, settings ─────────────────────────

type Period = {
    id: string;
    flatId: string;
    userId: string;
    fromDate: Date;
    toDate: Date | null;
    closedReason: OwnershipClosedReason | null;
    openedById: string | null;
    closedById: string | null;
};
type Unit = {
    id: string;
    userId: string;
    flatId: string | null;
    createdAt: Date;
};

const FLATS: Record<string, string> = {
    'A1-3-2': 'flat-a132',
    'B2-G-5': 'flat-b2g5',
    'C3-11-5': 'flat-c3115',
};
const labelOf = (flatId: string) =>
    Object.keys(FLATS).find(k => FLATS[k] === flatId) ?? '?';

function buildStore() {
    const periods: Period[] = [];
    const units: Unit[] = [];
    const deleted = new Set<string>();
    let goLive: unknown = '2026-11-10T08:00:00.000Z';
    let seq = 0;

    const matches = (p: Period, where: Partial<Period>) =>
        Object.entries(where).every(
            ([k, v]) => (p as Record<string, unknown>)[k] === v
        );

    const client = {
        flat: {
            findUnique: jest.fn(
                ({ where }: { where: { building_floor_flatNumber: { building: string; floor: string; flatNumber: string } } }) => {
                    const k = where.building_floor_flatNumber;
                    const id = FLATS[`${k.building}-${k.floor}-${k.flatNumber}`];
                    return Promise.resolve(id ? { id } : null);
                }
            ),
        },
        financeSetting: {
            findUnique: jest.fn(() =>
                Promise.resolve(goLive === undefined ? null : { value: goLive })
            ),
        },
        residentUnit: {
            update: jest.fn(
                ({ where, data }: { where: { id: string }; data: { flatId: string } }) => {
                    const u = units.find(x => x.id === where.id);
                    if (!u) throw new Error('unit not found');
                    u.flatId = data.flatId;
                    return Promise.resolve(u);
                }
            ),
            findMany: jest.fn(({ where }: { where: { userId: string } }) =>
                Promise.resolve(
                    units
                        .filter(u => u.userId === where.userId && u.flatId)
                        .sort(
                            (a, b) =>
                                a.createdAt.getTime() - b.createdAt.getTime() ||
                                a.id.localeCompare(b.id)
                        )
                        .map(u => ({
                            flatId: u.flatId,
                            flat: { label: labelOf(u.flatId as string) },
                        }))
                )
            ),
        },
        flatOwnership: {
            create: jest.fn(({ data }: { data: Omit<Period, 'id' | 'toDate' | 'closedReason' | 'closedById'> }) => {
                // flat_ownership_one_open
                if (periods.some(p => p.flatId === data.flatId && p.toDate === null))
                    return Promise.reject(
                        Object.assign(new Error('unique'), { code: 'P2002' })
                    );
                const row: Period = {
                    id: `p${++seq}`,
                    toDate: null,
                    closedReason: null,
                    closedById: null,
                    ...data,
                };
                periods.push(row);
                return Promise.resolve(row);
            }),
            findFirst: jest.fn(({ where }: { where: Partial<Period> }) =>
                Promise.resolve(periods.find(p => matches(p, where)) ?? null)
            ),
            update: jest.fn(
                ({ where, data }: { where: { id: string }; data: Partial<Period> }) => {
                    const p = periods.find(x => x.id === where.id) as Period;
                    Object.assign(p, data);
                    return Promise.resolve(p);
                }
            ),
            updateMany: jest.fn(
                ({ where, data }: { where: Partial<Period>; data: Partial<Period> }) => {
                    const hit = periods.filter(p => matches(p, where));
                    hit.forEach(p => Object.assign(p, data));
                    return Promise.resolve({ count: hit.length });
                }
            ),
        },
    };

    return {
        periods,
        units,
        deleted,
        client: client as unknown as OwnershipClient,
        setGoLive: (v: unknown) => {
            goLive = v;
        },
        addUnit: (u: Unit) => units.push(u),
        removeUnit: (id: string) =>
            units.splice(
                units.findIndex(u => u.id === id),
                1
            ),
        open: () => periods.filter(p => p.toDate === null),
    };
}

/** open period (flat, user) ⇔ linked unit ⇔ user not deleted. */
function assertInvariant(store: ReturnType<typeof buildStore>) {
    const expected = store.units
        .filter(u => u.flatId && !store.deleted.has(u.userId))
        .map(u => `${u.flatId}|${u.userId}`)
        .sort();
    const actual = store
        .open()
        .map(p => `${p.flatId}|${p.userId}`)
        .sort();
    expect(actual).toEqual(expected);
}

const serviceWith = (strict = false) =>
    new FlatOwnershipService({
        get: jest.fn((key: string) =>
            key === 'app.flatKeyStrict' ? strict : undefined
        ),
    } as unknown as ConfigService);

// ─── Cairo dates ──────────────────────────────────────────────────────────────

describe('cairo dates', () => {
    it('22:30 UTC in winter is already the next Cairo day', () => {
        expect(cairoDateString(new Date('2026-11-02T22:30:00Z'))).toBe(
            '2026-11-03'
        );
        expect(cairoDate(new Date('2026-11-02T22:30:00Z'))).toEqual(
            new Date('2026-11-03T00:00:00.000Z')
        );
    });

    it('21:59 UTC in winter is still the same Cairo day', () => {
        expect(cairoDateString(new Date('2026-11-02T21:59:00Z'))).toBe(
            '2026-11-02'
        );
    });

    it('cairoToday is UTC midnight of the Cairo day', () => {
        expect(cairoToday(new Date('2026-07-01T21:30:00Z'))).toEqual(
            new Date('2026-07-02T00:00:00.000Z')
        );
    });
});

// ─── Service ──────────────────────────────────────────────────────────────────

describe('FlatOwnershipService', () => {
    let store: ReturnType<typeof buildStore>;
    const service = serviceWith();

    beforeEach(() => {
        store = buildStore();
    });

    describe('resolveFlatId', () => {
        it('normalises the key before the lookup', async () => {
            await expect(
                service.resolveFlatId(store.client, {
                    building: ' a1 ',
                    floor: '3',
                    flatNumber: ' 2',
                })
            ).resolves.toBe('flat-a132');
        });

        it('unknown key → null when FLAT_KEY_STRICT is off (no DB lookup for a non-flat)', async () => {
            await expect(
                service.resolveFlatId(store.client, {
                    building: 'Building A',
                    floor: '3',
                    flatNumber: '2',
                })
            ).resolves.toBeNull();
            expect(
                (store.client as unknown as { flat: { findUnique: jest.Mock } })
                    .flat.findUnique
            ).not.toHaveBeenCalled();
        });

        it('unknown key → 400 unit.error.unknownFlat when FLAT_KEY_STRICT is on', async () => {
            const attempt = serviceWith(true).resolveFlatId(store.client, {
                building: 'Z9',
                floor: '1',
                flatNumber: '1',
            });
            await expect(attempt).rejects.toBeInstanceOf(BadRequestException);
            await expect(attempt).rejects.toThrow('unit.error.unknownFlat');
        });

        it('a known key missing from the flats table is treated as unknown', async () => {
            // E1-1-1 is a real flat but not in this fixture's flats table.
            await expect(
                service.resolveFlatId(store.client, {
                    building: 'E1',
                    floor: '1',
                    flatNumber: '1',
                })
            ).resolves.toBeNull();
        });
    });

    it('openForNewUnit opens today (Cairo) with the actor', async () => {
        await service.openForNewUnit(store.client, {
            flatId: 'flat-a132',
            userId: 'u1',
            actorId: 'admin-1',
        });
        expect(store.periods).toEqual([
            expect.objectContaining({
                flatId: 'flat-a132',
                userId: 'u1',
                fromDate: cairoToday(),
                toDate: null,
                openedById: 'admin-1',
            }),
        ]);
    });

    it('a second open period on the flat is 409 unit.error.alreadyOwned', async () => {
        await service.openForNewUnit(store.client, {
            flatId: 'flat-a132',
            userId: 'u1',
        });
        const attempt = service.openForNewUnit(store.client, {
            flatId: 'flat-a132',
            userId: 'u2',
        });
        await expect(attempt).rejects.toBeInstanceOf(ConflictException);
        await expect(attempt).rejects.toThrow('unit.error.alreadyOwned');
    });

    describe('linkAndOpen (NULL → linked)', () => {
        const unit = (createdAt: string) => ({
            id: 'ru1',
            userId: 'u1',
            flatId: null,
            createdAt: new Date(createdAt),
        });

        it('a unit created before go-live opens at the 1900-01-01 sentinel', async () => {
            const u = unit('2026-10-07T10:00:00Z');
            store.addUnit(u);
            await service.linkAndOpen(store.client, u, 'flat-a132', {
                userDeleted: false,
            });
            expect(store.units[0]?.flatId).toBe('flat-a132');
            expect(store.periods[0]?.fromDate).toEqual(OWNERSHIP_SENTINEL_DATE);
        });

        it('a unit created after go-live opens at its createdAt Cairo date', async () => {
            const u = unit('2026-11-20T22:30:00Z');
            store.addUnit(u);
            await service.linkAndOpen(store.client, u, 'flat-a132', {
                userDeleted: false,
            });
            expect(store.periods[0]?.fromDate).toEqual(
                new Date('2026-11-21T00:00:00.000Z')
            );
        });

        it.each([undefined, 'not a date', 42])(
            'a missing or garbled go-live (%p) falls back to the sentinel',
            async value => {
                store.setGoLive(value);
                const u = unit('2026-12-01T10:00:00Z');
                store.addUnit(u);
                await service.linkAndOpen(store.client, u, 'flat-a132', {
                    userDeleted: false,
                });
                expect(store.periods[0]?.fromDate).toEqual(
                    OWNERSHIP_SENTINEL_DATE
                );
            }
        );

        it('a soft-deleted owner gets the link but no period', async () => {
            const u = unit('2026-10-07T10:00:00Z');
            store.addUnit(u);
            store.deleted.add('u1');
            await service.linkAndOpen(store.client, u, 'flat-a132', {
                userDeleted: true,
            });
            expect(store.units[0]?.flatId).toBe('flat-a132');
            expect(store.periods).toHaveLength(0);
            assertInvariant(store);
        });
    });

    it('moveLink closes the old period as an empty REMOVED period and opens the new flat', async () => {
        const u = {
            id: 'ru1',
            userId: 'u1',
            flatId: 'flat-a132' as string | null,
            createdAt: new Date('2026-10-07T10:00:00Z'),
        };
        store.addUnit(u);
        await service.linkAndOpen(store.client, u, 'flat-a132', {
            userDeleted: false,
        });
        await service.moveLink(
            store.client,
            { ...u, flatId: 'flat-a132' },
            'flat-b2g5',
            { userDeleted: false, actorId: 'super-1' }
        );
        const [old, next] = store.periods;
        expect(old).toMatchObject({
            flatId: 'flat-a132',
            toDate: OWNERSHIP_SENTINEL_DATE,
            closedReason: OwnershipClosedReason.REMOVED,
            closedById: 'super-1',
        });
        expect(next).toMatchObject({
            flatId: 'flat-b2g5',
            toDate: null,
            fromDate: OWNERSHIP_SENTINEL_DATE,
        });
        assertInvariant(store);
    });

    it('closeAllForUser closes every open period with ACCOUNT_DELETED today', async () => {
        await service.openForNewUnit(store.client, { flatId: 'flat-a132', userId: 'u1' });
        await service.openForNewUnit(store.client, { flatId: 'flat-b2g5', userId: 'u1' });
        await service.openForNewUnit(store.client, { flatId: 'flat-c3115', userId: 'u2' });
        await service.closeAllForUser(store.client, 'u1', 'super-1');
        expect(store.open().map(p => p.userId)).toEqual(['u2']);
        expect(
            store.periods.filter(p => p.userId === 'u1').map(p => p.closedReason)
        ).toEqual([
            OwnershipClosedReason.ACCOUNT_DELETED,
            OwnershipClosedReason.ACCOUNT_DELETED,
        ]);
    });

    it('reopenForUser opens a new period per linked unit (oldest first) and returns labels', async () => {
        store.addUnit({ id: 'ru2', userId: 'u1', flatId: 'flat-b2g5', createdAt: new Date('2026-10-09') });
        store.addUnit({ id: 'ru1', userId: 'u1', flatId: 'flat-a132', createdAt: new Date('2026-10-08') });
        store.addUnit({ id: 'ru3', userId: 'u1', flatId: null, createdAt: new Date('2026-10-07') });
        await expect(
            service.reopenForUser(store.client, 'u1', 'super-1')
        ).resolves.toEqual(['A1-3-2', 'B2-G-5']);
        expect(store.open()).toHaveLength(2);
        expect(store.open().every(p => p.fromDate.getTime() === cairoToday().getTime())).toBe(true);
    });

    it('goLiveAt reads the seeded setting', async () => {
        await expect(service.goLiveAt(store.client)).resolves.toEqual(
            new Date('2026-11-10T08:00:00.000Z')
        );
        expect(
            (store.client as unknown as { financeSetting: { findUnique: jest.Mock } })
                .financeSetting.findUnique
        ).toHaveBeenCalledWith(
            expect.objectContaining({ where: { key: FINANCE_GO_LIVE_KEY } })
        );
    });

    // ─── Invariant over writer sequences (the order each writer calls) ──────

    describe('ownership invariant', () => {
        const unit = (id: string, userId: string, flatId: string | null) => ({
            id,
            userId,
            flatId,
            createdAt: new Date('2026-10-07T10:00:00Z'),
        });

        /** Paths 1-3: unit created with flatId, period opened in the same tx. */
        const addFlat = async (id: string, userId: string, flatId: string) => {
            store.addUnit(unit(id, userId, flatId));
            await service.openForNewUnit(store.client, { flatId, userId });
        };
        const deleteUser = async (userId: string) => {
            await service.closeAllForUser(store.client, userId, userId);
            store.deleted.add(userId);
        };
        const restoreUser = async (userId: string) => {
            store.deleted.delete(userId);
            await service.reopenForUser(store.client, userId, 'super-1');
        };
        /** Path 4: removeFromUser deletes the unit then closes its period. */
        const removeFlat = async (id: string) => {
            const u = store.units.find(x => x.id === id) as Unit;
            store.removeUnit(id);
            if (u.flatId)
                await service.closeForUnit(store.client, {
                    flatId: u.flatId,
                    userId: u.userId,
                    reason: OwnershipClosedReason.REMOVED,
                });
        };

        it('add → delete → restore', async () => {
            await addFlat('ru1', 'u1', 'flat-a132');
            await addFlat('ru2', 'u1', 'flat-b2g5');
            assertInvariant(store);
            await deleteUser('u1');
            assertInvariant(store);
            await restoreUser('u1');
            assertInvariant(store);
            // Closed history kept: two ACCOUNT_DELETED periods + two new open ones.
            expect(store.periods).toHaveLength(4);
        });

        it('delete → remove flat (path 4) on the deleted account → restore: no period for the removed flat', async () => {
            await addFlat('ru1', 'u1', 'flat-a132');
            await addFlat('ru2', 'u1', 'flat-b2g5');
            await deleteUser('u1');
            await removeFlat('ru1');
            assertInvariant(store);
            await restoreUser('u1');
            assertInvariant(store);
            expect(store.open().map(p => p.flatId)).toEqual(['flat-b2g5']);
        });

        it('delete → flat removed and given to another owner → restore does not collide', async () => {
            await addFlat('ru1', 'u1', 'flat-a132');
            await deleteUser('u1');
            await removeFlat('ru1');
            await addFlat('ru9', 'u2', 'flat-a132');
            await restoreUser('u1');
            assertInvariant(store);
        });

        it('link cases: NULL → linked, linked → other flat, deleted owner linked', async () => {
            const a = unit('ru1', 'u1', null);
            const b = unit('ru2', 'u2', null);
            store.addUnit(a);
            store.addUnit(b);
            assertInvariant(store); // flatId NULL units are outside the invariant
            await service.linkAndOpen(store.client, a, 'flat-a132', { userDeleted: false });
            assertInvariant(store);
            await service.moveLink(store.client, { ...a, flatId: 'flat-a132' }, 'flat-c3115', { userDeleted: false });
            assertInvariant(store);
            store.deleted.add('u2');
            await service.linkAndOpen(store.client, b, 'flat-b2g5', { userDeleted: true });
            assertInvariant(store);
            await restoreUser('u2');
            assertInvariant(store);
        });
    });
});

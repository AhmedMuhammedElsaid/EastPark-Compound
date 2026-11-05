import { FlatKey } from 'src/common/helper/utils/unit-label';

/**
 * The compound's physical flats: the one backend source of truth for "is this
 * a real flat". Mirrors `apps/web/src/config/compound.ts` (a unit test compares
 * the two, so they cannot drift silently). The finance seed (slice 4) and
 * `prisma/scripts/check-flat-keys.sql` are generated from this list.
 *
 * Phases 1 and 4: 6 buildings x floors 1-11 x flats 1-5 = 330.
 * Phases 2 and 3: 6 buildings x floors G + 1-11 x flats 1-5 = 360. Total 690.
 */
export const COMPOUND_BUILDINGS: readonly {
    readonly code: string;
    readonly hasGround: boolean;
}[] = [
    // Phase 1: no ground floor
    { code: 'A1', hasGround: false },
    { code: 'B1', hasGround: false },
    { code: 'C1', hasGround: false },
    // Phase 2: ground floor
    { code: 'A2', hasGround: true },
    { code: 'B2', hasGround: true },
    { code: 'C2', hasGround: true },
    // Phase 3: ground floor
    { code: 'D1', hasGround: true },
    { code: 'E1', hasGround: true },
    { code: 'F1', hasGround: true },
    // Phase 4: no ground floor
    { code: 'C3', hasGround: false },
    { code: 'E2', hasGround: false },
    { code: 'F2', hasGround: false },
];

export const GROUND_FLOOR = 'G';
export const MAX_FLOOR = 11;
export const FLATS_PER_FLOOR = 5;
export const EXPECTED_FLAT_COUNT = 690;

/** Every valid flat key, in building, floor (G first), flat order. */
function generateFlatKeys(): readonly FlatKey[] {
    const keys: FlatKey[] = [];
    for (const { code, hasGround } of COMPOUND_BUILDINGS) {
        const floors: string[] = hasGround ? [GROUND_FLOOR] : [];
        for (let f = 1; f <= MAX_FLOOR; f += 1) floors.push(String(f));
        for (const floor of floors) {
            for (let n = 1; n <= FLATS_PER_FLOOR; n += 1) {
                keys.push({
                    building: code,
                    floor,
                    flatNumber: String(n),
                });
            }
        }
    }
    return keys;
}

export const COMPOUND_FLAT_KEYS: readonly FlatKey[] = generateFlatKeys();

const keyString = (key: FlatKey): string =>
    `${key.building}|${key.floor}|${key.flatNumber}`;

const VALID_KEYS: ReadonlySet<string> = new Set(
    COMPOUND_FLAT_KEYS.map(keyString)
);

/**
 * Canonical spelling of a flat key: building and floor trimmed and upper-cased,
 * flat number trimmed. Does not validate; pair with `isKnownFlat`.
 */
export function normaliseFlatKey(key: FlatKey): FlatKey {
    return {
        building: key.building.trim().toUpperCase(),
        floor: key.floor.trim().toUpperCase(),
        flatNumber: key.flatNumber.trim(),
    };
}

/** True when the key (after normalisation) is one of the 690 flats. */
export function isKnownFlat(key: FlatKey): boolean {
    return VALID_KEYS.has(keyString(normaliseFlatKey(key)));
}

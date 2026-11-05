import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';

import {
    COMPOUND_BUILDINGS,
    COMPOUND_FLAT_KEYS,
    EXPECTED_FLAT_COUNT,
    isKnownFlat,
    normaliseFlatKey,
} from 'src/common/finance/compound-layout';
import { ResidentLeadUnitUpdateDto } from 'src/modules/residents/dtos/request/resident-lead.unit.update.dto';
import { ResidentUnitKeyUpdateDto } from 'src/modules/units/dtos/resident-unit.dto';

const WEB_COMPOUND = join(__dirname, '../../../web/src/config/compound.ts');

describe('compound layout', () => {
    it('has exactly 690 unique flats', () => {
        expect(EXPECTED_FLAT_COUNT).toBe(690);
        expect(COMPOUND_FLAT_KEYS).toHaveLength(690);
        const unique = new Set(
            COMPOUND_FLAT_KEYS.map(k => `${k.building}|${k.floor}|${k.flatNumber}`)
        );
        expect(unique.size).toBe(690);
    });

    it('has 12 buildings, ground floor only in phases 2 and 3', () => {
        expect(COMPOUND_BUILDINGS).toHaveLength(12);
        const ground = COMPOUND_BUILDINGS.filter(b => b.hasGround).map(
            b => b.code
        );
        expect(ground).toEqual(['A2', 'B2', 'C2', 'D1', 'E1', 'F1']);
    });

    it('matches the web compound config (buildings, phases, ground floors)', () => {
        const src = readFileSync(WEB_COMPOUND, 'utf8');
        const phases = [
            ...src.matchAll(
                /id: '(phase-\d)'[^}]*hasGround: (true|false), maxFloor: (\d+)/g
            ),
        ];
        expect(phases).toHaveLength(4);
        const ground = new Map(
            phases.map(m => [m[1] as string, m[2] === 'true'])
        );
        phases.forEach(m => expect(m[3]).toBe('11'));

        const webBuildings = [
            ...src.matchAll(/\{ value: '(\w+)', labelEn: '\w+', labelAr: '\w+', phase: '(phase-\d)' \}/g),
        ].map(m => ({
            code: m[1] as string,
            hasGround: ground.get(m[2] as string) as boolean,
        }));
        expect(webBuildings).toEqual(COMPOUND_BUILDINGS);

        expect(src).toMatch(/FLAT_RANGE = \{ min: 1, max: 5 \}/);
    });

    describe('normaliseFlatKey', () => {
        it.each([
            [{ building: ' a1 ', floor: ' g ', flatNumber: ' 2 ' }, 'A1', 'G', '2'],
            [{ building: 'c3', floor: '11', flatNumber: '5' }, 'C3', '11', '5'],
            [{ building: 'A1', floor: '3', flatNumber: '2' }, 'A1', '3', '2'],
        ])('%j', (input, building, floor, flatNumber) => {
            expect(normaliseFlatKey(input)).toEqual({
                building,
                floor,
                flatNumber,
            });
        });
    });

    describe('isKnownFlat', () => {
        it.each([
            ['A1', '1', '1'],
            ['a2', 'g', '5'],
            [' F2 ', '11', '3'],
        ])('accepts %s-%s-%s', (building, floor, flatNumber) => {
            expect(isKnownFlat({ building, floor, flatNumber })).toBe(true);
        });

        it.each([
            ['Building A', '3', '2'],
            ['A1', 'G', '1'], // phase 1 has no ground floor
            ['C3', 'G', '1'],
            ['D2', '3', '2'], // not in the layout
            ['A1', '12', '1'],
            ['A1', '0', '1'],
            ['A1', '3', '6'],
            ['A1', '3', '0'],
            ['', '3', '2'],
        ])('rejects %s-%s-%s', (building, floor, flatNumber) => {
            expect(isKnownFlat({ building, floor, flatNumber })).toBe(false);
        });
    });

    describe('check-flat-keys.sql', () => {
        const sql = readFileSync(
            join(__dirname, '../../prisma/scripts/check-flat-keys.sql'),
            'utf8'
        );

        it('lists exactly the generated keys', () => {
            const listed = [...sql.matchAll(/\('([A-Z0-9]+)','(G|\d+)','(\d)'\)/g)].map(
                m => `${m[1]}|${m[2]}|${m[3]}`
            );
            const expected = COMPOUND_FLAT_KEYS.map(
                k => `${k.building}|${k.floor}|${k.flatNumber}`
            );
            expect(listed).toEqual(expected);
        });

        it('is read-only and never selects PII columns', () => {
            const code = sql
                .split('\n')
                .filter(line => !line.trim().startsWith('--'))
                .join('\n');
            expect(code).not.toMatch(
                /\b(insert|update|delete|drop|alter|truncate|create|grant)\b/i
            );
            expect(code).not.toMatch(
                /"(email|name|phone|nationalId|passportNumber|userId)"/
            );
        });
    });

    describe('DTO validation', () => {
        const check = async (
            Cls: new () => object,
            body: Record<string, unknown>
        ) => validate(plainToInstance(Cls, body));

        it.each([ResidentUnitKeyUpdateDto, ResidentLeadUnitUpdateDto])(
            '%p normalises case and accepts a real flat',
            async Cls => {
                const instance = plainToInstance(Cls as new () => {
                    building: string;
                    floor: string;
                }, { building: ' a2 ', floor: 'g', flatNumber: '3' });
                expect(await validate(instance)).toHaveLength(0);
                expect(instance.building).toBe('A2');
                expect(instance.floor).toBe('G');
            }
        );

        it.each([
            { building: 'Building A', floor: '3', flatNumber: '2' },
            { building: 'A1', floor: 'G', flatNumber: '2' },
            { building: 'Z9', floor: '3', flatNumber: '2' },
        ])('rejects %j', async body => {
            const errors = await check(ResidentLeadUnitUpdateDto, body);
            expect(errors.map(e => e.property)).toContain('building');
        });
    });
});

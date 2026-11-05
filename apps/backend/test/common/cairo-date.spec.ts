import {
    addDays,
    cairoDate,
    cairoDateString,
    cairoDayStart,
    cairoPeriod,
    dateOnlyString,
    daysBetween,
    fiscalYearOf,
    isDateOnly,
    isPeriod,
    isSameCairoDay,
    parseDateOnly,
    periodOf,
} from 'src/common/finance/cairo-date';

const at = (iso: string) => new Date(iso);

describe('cairo-date (plan 2.1 point 6)', () => {
    it('pins 2026-12-31T22:30Z to 2027-01-01 (winter, UTC+2)', () => {
        expect(cairoDateString(at('2026-12-31T22:30:00Z'))).toBe('2027-01-01');
        expect(cairoDateString(at('2026-12-31T21:59:59Z'))).toBe('2026-12-31');
        expect(dateOnlyString(cairoDate(at('2026-12-31T22:30:00Z')))).toBe(
            '2027-01-01'
        );
        expect(cairoPeriod(at('2026-12-31T22:30:00Z'))).toBe('2027-01');
    });

    it('uses UTC+3 in summer: 21:30Z is already the next Cairo day', () => {
        expect(cairoDateString(at('2026-07-01T21:30:00Z'))).toBe('2026-07-02');
        expect(cairoDateString(at('2026-07-01T20:59:59Z'))).toBe('2026-07-01');
        // the same UTC time in winter is still the same day
        expect(cairoDateString(at('2026-01-15T21:30:00Z'))).toBe('2026-01-15');
    });

    it('pins the spring DST change (last Friday of April 2026, 00:00 -> 01:00)', () => {
        // 2026-04-23T21:59Z is 23:59 Thursday (UTC+2); 22:00Z is 01:00 Friday (UTC+3)
        expect(cairoDateString(at('2026-04-23T21:59:59Z'))).toBe('2026-04-23');
        expect(cairoDateString(at('2026-04-23T22:00:00Z'))).toBe('2026-04-24');
        expect(cairoDayStart(parseDateOnly('2026-04-24')).toISOString()).toBe(
            '2026-04-23T22:00:00.000Z'
        );
        // the next day starts at 21:00Z (UTC+3)
        expect(cairoDayStart(parseDateOnly('2026-04-25')).toISOString()).toBe(
            '2026-04-24T21:00:00.000Z'
        );
    });

    it('pins the autumn DST change (last Thursday of October 2026, 24:00 -> 23:00)', () => {
        // Thursday 29 Oct starts at 21:00Z (UTC+3); Friday 30 Oct at 22:00Z (UTC+2)
        expect(cairoDayStart(parseDateOnly('2026-10-29')).toISOString()).toBe(
            '2026-10-28T21:00:00.000Z'
        );
        expect(cairoDayStart(parseDateOnly('2026-10-30')).toISOString()).toBe(
            '2026-10-29T22:00:00.000Z'
        );
        // the repeated hour 23:00-23:59 local still belongs to Thursday
        expect(cairoDateString(at('2026-10-29T21:30:00Z'))).toBe('2026-10-29');
        expect(cairoDateString(at('2026-10-29T22:00:00Z'))).toBe('2026-10-30');
    });

    it('cairoDayStart is the first instant of the Cairo day', () => {
        for (const day of ['2026-01-01', '2026-06-15', '2027-01-01']) {
            const start = cairoDayStart(parseDateOnly(day));
            expect(cairoDateString(start)).toBe(day);
            expect(cairoDateString(new Date(start.getTime() - 1))).not.toBe(
                day
            );
        }
    });

    it('isSameCairoDay compares Cairo days, not UTC days', () => {
        // 23:30 Cairo and 00:10 Cairo the next day: same UTC day, different Cairo days
        expect(
            isSameCairoDay(
                at('2026-11-02T21:30:00Z'),
                at('2026-11-02T22:10:00Z')
            )
        ).toBe(false);
        // 00:30 and 23:00 Cairo of the same day: different UTC days
        expect(
            isSameCairoDay(
                at('2026-11-01T22:30:00Z'),
                at('2026-11-02T21:00:00Z')
            )
        ).toBe(true);
    });

    it('validates and parses date-only and period strings', () => {
        expect(isDateOnly('2026-02-28')).toBe(true);
        expect(isDateOnly('2026-02-30')).toBe(false);
        expect(isDateOnly('2026-2-3')).toBe(false);
        expect(() => parseDateOnly('nope')).toThrow(RangeError);
        expect(isPeriod('2026-12')).toBe(true);
        expect(isPeriod('2026-13')).toBe(false);
        expect(isPeriod('2026-1')).toBe(false);
        expect(periodOf(parseDateOnly('2026-11-30'))).toBe('2026-11');
    });

    it('date arithmetic stays on calendar days', () => {
        const d = parseDateOnly('2026-12-31');
        expect(dateOnlyString(addDays(d, 1))).toBe('2027-01-01');
        expect(
            daysBetween(
                parseDateOnly('2026-11-10'),
                parseDateOnly('2026-12-03')
            )
        ).toBe(23);
    });

    it('fiscalYearOf: January year is the calendar year; other years get a label', () => {
        expect(fiscalYearOf(parseDateOnly('2026-12-31'), 1)).toEqual({
            year: 2026,
            label: '2026',
        });
        expect(fiscalYearOf(parseDateOnly('2027-01-01'), 1)).toEqual({
            year: 2027,
            label: '2027',
        });
        expect(fiscalYearOf(parseDateOnly('2026-07-01'), 7)).toEqual({
            year: 2026,
            label: '2627',
        });
        expect(fiscalYearOf(parseDateOnly('2027-06-30'), 7)).toEqual({
            year: 2026,
            label: '2627',
        });
    });
});

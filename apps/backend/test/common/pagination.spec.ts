import { cursorArgs, toCursorPage } from 'src/common/helper/pagination';

/** In-memory stand-in for Prisma's `take` + `cursor` + `skip: 1` semantics. */
function fetchPage(
    all: { id: string }[],
    take: number,
    args: ReturnType<typeof cursorArgs>
): { id: string }[] {
    let start = 0;
    if ('cursor' in args) {
        start = all.findIndex(row => row.id === args.cursor.id) + args.skip;
    }
    return all.slice(start, start + take);
}

describe('cursor pagination helpers', () => {
    it('cursorArgs resumes after the cursor row, or starts at the top', () => {
        expect(cursorArgs(undefined)).toEqual({});
        expect(cursorArgs('abc')).toEqual({ skip: 1, cursor: { id: 'abc' } });
    });

    it('returns every row exactly once across pages', () => {
        const all = Array.from({ length: 47 }, (_, i) => ({ id: `row-${i}` }));
        const limit = 10;
        const seen: string[] = [];
        let cursor: string | undefined;
        let pages = 0;

        do {
            const rows = fetchPage(all, limit + 1, cursorArgs(cursor));
            const page = toCursorPage(rows, limit);
            seen.push(...page.items.map(row => row.id));
            cursor = page.nextCursor;
            pages++;
        } while (cursor && pages < 20);

        expect(seen).toEqual(all.map(row => row.id));
        expect(pages).toBe(5);
    });

    it('points nextCursor at the last returned row, not the look-ahead row', () => {
        const rows = [{ id: 'a' }, { id: 'b' }, { id: 'c' }];
        expect(toCursorPage(rows, 2)).toEqual({
            items: [{ id: 'a' }, { id: 'b' }],
            nextCursor: 'b',
        });
    });

    it('has no nextCursor when the page is not full', () => {
        expect(toCursorPage([{ id: 'a' }], 2)).toEqual({ items: [{ id: 'a' }] });
        expect(toCursorPage([], 2)).toEqual({ items: [] });
    });

    it('supports a custom cursor key', () => {
        const rows = [{ shopId: 's1' }, { shopId: 's2' }];
        expect(toCursorPage(rows, 1, row => row.shopId).nextCursor).toBe('s1');
    });
});

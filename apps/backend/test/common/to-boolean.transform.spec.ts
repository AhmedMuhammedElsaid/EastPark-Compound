import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';

import { NotificationQueryDto } from 'src/modules/notifications/dtos/request/notification.query.dto';
import { ProductQueryDto } from 'src/modules/products/dtos/request/product.query.dto';

async function parse<T extends object>(
    cls: new () => T,
    query: Record<string, unknown>
): Promise<{ dto: T; errors: number }> {
    const dto = plainToInstance(cls, query);
    const errors = await validate(dto);
    return { dto, errors: errors.length };
}

describe('ToBoolean query transform', () => {
    it.each([
        ['true', true],
        ['false', false],
        ['1', true],
        ['0', false],
        ['FALSE', false],
    ])('isRead=%s parses to %s', async (raw, expected) => {
        const { dto, errors } = await parse(NotificationQueryDto, {
            isRead: raw,
        });
        expect(errors).toBe(0);
        expect(dto.isRead).toBe(expected);
    });

    it('isAvailable=false filters unavailable products (was coerced to true)', async () => {
        const { dto, errors } = await parse(ProductQueryDto, {
            isAvailable: 'false',
        });
        expect(errors).toBe(0);
        expect(dto.isAvailable).toBe(false);
    });

    it('leaves the filter unset when omitted', async () => {
        const { dto, errors } = await parse(NotificationQueryDto, {});
        expect(errors).toBe(0);
        expect(dto.isRead).toBeUndefined();
    });

    it('rejects a non-boolean value instead of coercing it', async () => {
        const { errors } = await parse(ProductQueryDto, { isAvailable: 'yes' });
        expect(errors).toBe(1);
    });
});

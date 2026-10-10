import { OrderStatus, PaymentMethod, Prisma } from '@prisma/client';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';

import {
    ORDER_MAX_ITEMS,
    OrderCreateDto,
} from 'src/modules/orders/dtos/request/order.create.dto';
import { OrderUpdateStatusDto } from 'src/modules/orders/dtos/request/order.update-status.dto';
import {
    PRODUCT_MAX_PRICE,
    ProductCreateDto,
} from 'src/modules/products/dtos/request/product.create.dto';
import { ProductUpdateDto } from 'src/modules/products/dtos/request/product.update.dto';
import { toProductResponse } from 'src/modules/products/products.service';

async function errorsFor<T extends object>(
    cls: new () => T,
    plain: Record<string, unknown>
): Promise<string[]> {
    const errors = await validate(plainToInstance(cls, plain));
    const flatten = (list: typeof errors): string[] =>
        list.flatMap(e => [e.property, ...flatten(e.children ?? [])]);
    return flatten(errors);
}

describe('Order and product DTO validation', () => {
    const order = (quantity: number) => ({
        items: [{ productId: 'prod-1', quantity }],
        deliveryUnit: 'A1',
        paymentMethod: PaymentMethod.CASH,
    });

    it('accepts quantity 1..99 and rejects 100', async () => {
        expect(await errorsFor(OrderCreateDto, order(1))).toEqual([]);
        expect(await errorsFor(OrderCreateDto, order(99))).toEqual([]);
        expect(await errorsFor(OrderCreateDto, order(100))).toContain(
            'quantity'
        );
        expect(await errorsFor(OrderCreateDto, order(0))).toContain(
            'quantity'
        );
    });

    it('accepts up to ORDER_MAX_ITEMS (50) lines and rejects 51', async () => {
        const lines = (n: number) => ({
            ...order(1),
            items: Array.from({ length: n }, (_, i) => ({
                productId: `prod-${i}`,
                quantity: 1,
            })),
        });
        expect(ORDER_MAX_ITEMS).toBe(50);
        expect(await errorsFor(OrderCreateDto, lines(50))).toEqual([]);
        expect(await errorsFor(OrderCreateDto, lines(51))).toContain('items');
    });

    it('never lets a client set status back to PLACED', async () => {
        expect(
            await errorsFor(OrderUpdateStatusDto, {
                status: OrderStatus.PLACED,
            })
        ).toContain('status');
        expect(
            await errorsFor(OrderUpdateStatusDto, {
                status: OrderStatus.CONFIRMED,
            })
        ).toEqual([]);
    });

    const product = (price: unknown) => ({
        name: 'Latte',
        nameAr: 'لاتيه',
        price,
    });

    it('requires product price ≥ 0.01 with at most 2 decimals', async () => {
        expect(await errorsFor(ProductCreateDto, product(0))).toContain(
            'price'
        );
        expect(await errorsFor(ProductCreateDto, product(0.001))).toContain(
            'price'
        );
        expect(await errorsFor(ProductCreateDto, product(0.01))).toEqual([]);
        expect(await errorsFor(ProductUpdateDto, { price: 0 })).toContain(
            'price'
        );
    });

    it('caps product price at PRODUCT_MAX_PRICE (100,000) on create and update', async () => {
        expect(PRODUCT_MAX_PRICE).toBe(100_000);
        expect(await errorsFor(ProductCreateDto, product(100_000))).toEqual([]);
        expect(await errorsFor(ProductCreateDto, product(100_000.01))).toContain(
            'price'
        );
        // Would overflow Decimal(10,2) if it ever reached Prisma.
        expect(
            await errorsFor(ProductCreateDto, product(1_000_000_000))
        ).toContain('price');
        expect(await errorsFor(ProductUpdateDto, { price: 100_000 })).toEqual([]);
        expect(
            await errorsFor(ProductUpdateDto, { price: 100_000.01 })
        ).toContain('price');
    });

    it('returns product price as a JSON number', () => {
        const response = toProductResponse({
            id: 'p1',
            name: 'Latte',
            nameAr: 'لاتيه',
            description: null,
            descriptionAr: null,
            price: new Prisma.Decimal('35.50'),
            imageUrl: null,
            isAvailable: true,
            isDeleted: false,
            shopId: 's1',
            createdAt: new Date(0),
            updatedAt: new Date(0),
        });
        expect(response.price).toBe(35.5);
        expect(typeof JSON.parse(JSON.stringify(response)).price).toBe(
            'number'
        );
    });
});

import { sign } from 'jsonwebtoken';

import { OrdersGateway } from 'src/modules/orders/orders.gateway';

const SECRET = 'test-secret';
const config = { getOrThrow: () => SECRET } as any;
const db = { order: { findUnique: jest.fn() } };

const client = (auth: any, headers: any = {}) =>
    ({
        id: 's1',
        data: {} as any,
        handshake: { auth, headers },
        disconnect: jest.fn(),
        join: jest.fn(),
    }) as any;

describe('OrdersGateway auth', () => {
    let gw: OrdersGateway;
    beforeEach(() => {
        jest.clearAllMocks();
        gw = new OrdersGateway(config, db as any);
    });

    it('disconnects without token', () => {
        const c = client({});
        gw.handleConnection(c);
        expect(c.disconnect).toHaveBeenCalled();
    });

    it('disconnects with invalid token', () => {
        const c = client({ token: 'nope' });
        gw.handleConnection(c);
        expect(c.disconnect).toHaveBeenCalled();
    });

    it('accepts handshake.auth.token and Authorization header', () => {
        const t = sign({ userId: 'u1', role: 'RESIDENT' }, SECRET);
        const a = client({ token: t });
        gw.handleConnection(a);
        expect(a.data.user.userId).toBe('u1');
        const b = client({}, { authorization: `Bearer ${t}` });
        gw.handleConnection(b);
        expect(b.disconnect).not.toHaveBeenCalled();
    });

    it('join: resident owner ok, stranger rejected, admin ok', async () => {
        db.order.findUnique.mockResolvedValue({
            residentId: 'u1',
            shop: { merchantId: 'm1' },
        });
        const owner = client({});
        owner.data.user = { userId: 'u1', role: 'RESIDENT' };
        await gw.handleJoinOrder(owner, 'o1');
        expect(owner.join).toHaveBeenCalledWith('order:o1');

        const merchant = client({});
        merchant.data.user = { userId: 'm1', role: 'MERCHANT' };
        await gw.handleJoinOrder(merchant, 'o1');
        expect(merchant.join).toHaveBeenCalled();

        const stranger = client({});
        stranger.data.user = { userId: 'x', role: 'RESIDENT' };
        await expect(gw.handleJoinOrder(stranger, 'o1')).rejects.toThrow();
        expect(stranger.join).not.toHaveBeenCalled();

        const admin = client({});
        admin.data.user = { userId: 'a', role: 'ADMIN' };
        await gw.handleJoinOrder(admin, 'o1');
        expect(admin.join).toHaveBeenCalled();
    });
});

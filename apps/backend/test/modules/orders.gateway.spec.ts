import { sign } from 'jsonwebtoken';

import { OrdersGateway } from 'src/modules/orders/orders.gateway';

const SECRET = 'test-secret';
const config = { getOrThrow: () => SECRET } as any;
const db = { order: { findUnique: jest.fn() } };
const sessions = {
    getCurrent: jest.fn(),
    assertCurrent: jest.fn(),
};

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
        sessions.getCurrent.mockResolvedValue(0);
        // Real comparison rule against the mocked current version.
        sessions.assertCurrent.mockImplementation(
            async (p: { userId: string; ver?: number }) => {
                if ((p.ver ?? 0) < (await sessions.getCurrent(p.userId)))
                    throw new Error('revoked');
            }
        );
        gw = new OrdersGateway(config, db as any, sessions as any);
    });

    it('disconnects without token', async () => {
        const c = client({});
        await gw.handleConnection(c);
        expect(c.disconnect).toHaveBeenCalled();
    });

    it('disconnects with invalid token', async () => {
        const c = client({ token: 'nope' });
        await gw.handleConnection(c);
        expect(c.disconnect).toHaveBeenCalled();
    });

    it('accepts handshake.auth.token and Authorization header', async () => {
        const t = sign({ userId: 'u1', role: 'RESIDENT' }, SECRET);
        const a = client({ token: t });
        await gw.handleConnection(a);
        expect(a.data.user.userId).toBe('u1');
        const b = client({}, { authorization: `Bearer ${t}` });
        await gw.handleConnection(b);
        expect(b.disconnect).not.toHaveBeenCalled();
    });

    it('disconnects a token issued before the session version was bumped', async () => {
        sessions.getCurrent.mockResolvedValue(1);
        const t = sign({ userId: 'u1', role: 'RESIDENT', ver: 0 }, SECRET);
        const c = client({ token: t });
        await gw.handleConnection(c);
        expect(c.disconnect).toHaveBeenCalledWith(true);
        expect(c.data.user).toBeUndefined();
    });

    it('accepts a legacy token without ver while the version is 0', async () => {
        const t = sign({ userId: 'u1', role: 'RESIDENT' }, SECRET);
        const c = client({ token: t });
        await gw.handleConnection(c);
        expect(sessions.assertCurrent).toHaveBeenCalledWith({
            userId: 'u1',
            ver: undefined,
        });
        expect(c.disconnect).not.toHaveBeenCalled();
        expect(c.data.user).toEqual({ userId: 'u1', role: 'RESIDENT' });
    });

    it('disconnects when the session store is unavailable', async () => {
        sessions.assertCurrent.mockRejectedValue(new Error('redis down'));
        const t = sign({ userId: 'u1', role: 'RESIDENT', ver: 0 }, SECRET);
        const c = client({ token: t });
        await gw.handleConnection(c);
        expect(c.disconnect).toHaveBeenCalledWith(true);
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

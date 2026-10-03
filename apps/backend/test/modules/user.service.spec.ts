import { ConflictException, NotFoundException } from '@nestjs/common';
import { Role } from '@prisma/client';

import { SessionVersionService } from 'src/common/auth/services/session-version.service';
import { DatabaseService } from 'src/common/database/services/database.service';
import { UserService } from 'src/modules/user/services/user.service';

const deleteManyModels = [
    'notificationPreference',
    'notification',
    'auditLog',
    'feedbackReply',
    'feedback',
    'comment',
    'electionVote',
    'vote',
    'review',
    'savedShop',
    'orderItem',
    'order',
    'invitation',
] as const;

function buildTx() {
    const tx: Record<string, Record<string, jest.Mock>> = {};
    for (const model of deleteManyModels) {
        tx[model] = { deleteMany: jest.fn().mockResolvedValue({ count: 0 }) };
    }
    tx.user = { delete: jest.fn().mockResolvedValue({}) };
    tx.shop = {
        findMany: jest.fn(),
        deleteMany: jest.fn(),
        count: jest.fn(),
    };
    tx.product = { deleteMany: jest.fn() };
    tx.shopPhoto = { deleteMany: jest.fn() };
    return tx;
}

describe('UserService.deleteUser', () => {
    let tx: ReturnType<typeof buildTx>;
    const db = {
        user: { findUnique: jest.fn() },
        shop: { count: jest.fn() },
        $transaction: jest.fn(),
    };
    const sessions = { revokeDeletedUser: jest.fn() };
    const service = new UserService(
        db as unknown as DatabaseService,
        sessions as unknown as SessionVersionService
    );

    beforeEach(() => {
        jest.clearAllMocks();
        tx = buildTx();
        sessions.revokeDeletedUser.mockResolvedValue(undefined);
        db.$transaction.mockImplementation(
            (fn: (t: typeof tx) => Promise<unknown>) => fn(tx)
        );
    });

    it('refuses to delete a merchant that still owns a shop', async () => {
        db.user.findUnique.mockResolvedValue({
            id: 'merchant-1',
            role: Role.MERCHANT,
        });
        db.shop.count.mockResolvedValue(1);

        const result = service.deleteUser('merchant-1');
        await expect(result).rejects.toBeInstanceOf(ConflictException);
        await expect(result).rejects.toThrow('user.error.merchantOwnsShop');
        expect(db.shop.count).toHaveBeenCalledWith({
            where: { merchantId: 'merchant-1' },
        });
        expect(db.$transaction).not.toHaveBeenCalled();
        expect(sessions.revokeDeletedUser).not.toHaveBeenCalled();
    });

    it('deletes a resident with their own orders and never touches shops', async () => {
        db.user.findUnique.mockResolvedValue({
            id: 'resident-1',
            role: Role.RESIDENT,
        });
        db.shop.count.mockResolvedValue(0);

        await expect(service.deleteUser('resident-1')).resolves.toEqual({
            success: true,
            message: 'User deleted',
        });
        expect(db.$transaction).toHaveBeenCalledTimes(1);
        expect(tx.order.deleteMany).toHaveBeenCalledWith({
            where: { residentId: 'resident-1' },
        });
        expect(tx.order.deleteMany).toHaveBeenCalledTimes(1);
        expect(tx.user.delete).toHaveBeenCalledWith({
            where: { id: 'resident-1' },
        });
        for (const fn of Object.values(tx.shop)) {
            expect(fn).not.toHaveBeenCalled();
        }
        expect(tx.product.deleteMany).not.toHaveBeenCalled();
        expect(tx.shopPhoto.deleteMany).not.toHaveBeenCalled();
        expect(sessions.revokeDeletedUser).toHaveBeenCalledWith('resident-1');
    });

    it('does not revoke sessions when the delete transaction fails', async () => {
        db.user.findUnique.mockResolvedValue({
            id: 'resident-1',
            role: Role.RESIDENT,
        });
        db.shop.count.mockResolvedValue(0);
        db.$transaction.mockRejectedValue(new Error('db down'));

        await expect(service.deleteUser('resident-1')).rejects.toThrow(
            'db down'
        );
        expect(sessions.revokeDeletedUser).not.toHaveBeenCalled();
    });

    it('self-delete (deleteAccount) gets the same 409 for a shop-owning merchant', async () => {
        db.user.findUnique.mockResolvedValue({
            id: 'merchant-1',
            role: Role.MERCHANT,
        });
        db.shop.count.mockResolvedValue(2);

        await expect(service.deleteAccount('merchant-1')).rejects.toThrow(
            new ConflictException('user.error.merchantOwnsShop')
        );
        expect(db.$transaction).not.toHaveBeenCalled();
    });

    it('unknown user is a 404', async () => {
        db.user.findUnique.mockResolvedValue(null);

        await expect(service.deleteUser('nope')).rejects.toBeInstanceOf(
            NotFoundException
        );
        expect(db.shop.count).not.toHaveBeenCalled();
        expect(db.$transaction).not.toHaveBeenCalled();
    });
});

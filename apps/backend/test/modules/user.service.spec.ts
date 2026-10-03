import {
    BadRequestException,
    ConflictException,
    NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Role } from '@prisma/client';

import { SessionVersionService } from 'src/common/auth/services/session-version.service';
import { DatabaseService } from 'src/common/database/services/database.service';
import { HelperEncryptionService } from 'src/common/helper/services/helper.encryption.service';
import {
    DELETED_USER_NAME,
    deletedUserEmail,
    isDeletedUserEmail,
    UserService,
} from 'src/modules/user/services/user.service';

const models = [
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
    'residentLead',
    'shop',
    'product',
    'shopPhoto',
] as const;

function buildTx() {
    const tx: Record<string, Record<string, jest.Mock>> = {};
    for (const model of models) {
        tx[model] = {
            deleteMany: jest.fn().mockResolvedValue({ count: 0 }),
            updateMany: jest.fn().mockResolvedValue({ count: 0 }),
        };
    }
    tx.user = {
        delete: jest.fn().mockResolvedValue({}),
        update: jest.fn().mockResolvedValue({}),
    };
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
    const encryption = { createHash: jest.fn() };
    const service = new UserService(
        db as unknown as DatabaseService,
        sessions as unknown as SessionVersionService,
        encryption as unknown as HelperEncryptionService,
        {} as ConfigService
    );

    const resident = {
        id: 'resident-1',
        email: 'resident@example.com',
        role: Role.RESIDENT,
    };

    beforeEach(() => {
        jest.clearAllMocks();
        tx = buildTx();
        sessions.revokeDeletedUser.mockResolvedValue(undefined);
        encryption.createHash.mockResolvedValue('$argon2id$random');
        db.$transaction.mockImplementation(
            (fn: (t: typeof tx) => Promise<unknown>) => fn(tx)
        );
    });

    it('refuses to delete a merchant that still owns a shop', async () => {
        db.user.findUnique.mockResolvedValue({
            id: 'merchant-1',
            email: 'm@example.com',
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

    describe('resident deletion anonymises instead of destroying', () => {
        beforeEach(async () => {
            db.user.findUnique.mockResolvedValue(resident);
            db.shop.count.mockResolvedValue(0);
            await expect(service.deleteUser('resident-1')).resolves.toEqual({
                success: true,
                message: 'User deleted',
            });
        });

        it('keeps the account row as a tombstone with every personal field overwritten', () => {
            expect(tx.user.delete).not.toHaveBeenCalled();
            expect(tx.user.update).toHaveBeenCalledWith({
                where: { id: 'resident-1' },
                data: {
                    name: DELETED_USER_NAME,
                    email: 'deleted-resident-1@deleted.invalid',
                    phone: null,
                    unitNumber: null,
                    avatarUrl: null,
                    pushToken: null,
                    passwordHash: '$argon2id$random',
                    isVerified: false,
                    role: Role.GUEST,
                },
            });
            // The replacement password is a real hash of a random secret.
            const [secret] = encryption.createHash.mock.calls[0] as [string];
            expect(secret).toMatch(/^[0-9a-f]{64}$/);
        });

        it("keeps orders and order items (the shop's sales history)", () => {
            expect(tx.order.deleteMany).not.toHaveBeenCalled();
            expect(tx.orderItem.deleteMany).not.toHaveBeenCalled();
        });

        it('keeps review ratings but clears the review text', () => {
            expect(tx.review.deleteMany).not.toHaveBeenCalled();
            expect(tx.review.updateMany).toHaveBeenCalledWith({
                where: { userId: 'resident-1' },
                data: { comment: null },
            });
        });

        it('keeps poll and election votes so tallies do not change', () => {
            expect(tx.vote.deleteMany).not.toHaveBeenCalled();
            expect(tx.electionVote.deleteMany).not.toHaveBeenCalled();
        });

        it('keeps feedback for the administration, forced anonymous', () => {
            expect(tx.feedback.deleteMany).not.toHaveBeenCalled();
            expect(tx.feedbackReply.deleteMany).not.toHaveBeenCalled();
            expect(tx.feedback.updateMany).toHaveBeenCalledWith({
                where: { userId: 'resident-1' },
                data: { isAnonymous: true },
            });
        });

        it('deletes purely personal data: comments, notifications, preferences, saved shops', () => {
            for (const model of [
                'comment',
                'notification',
                'notificationPreference',
                'savedShop',
            ] as const) {
                expect(tx[model].deleteMany).toHaveBeenCalledWith({
                    where: { userId: 'resident-1' },
                });
            }
        });

        it('detaches resident leads as the old FK SET NULL did', () => {
            expect(tx.residentLead.updateMany).toHaveBeenCalledWith({
                where: { userId: 'resident-1' },
                data: { userId: null },
            });
        });

        it('never touches shops, products or photos', () => {
            for (const model of ['shop', 'product', 'shopPhoto'] as const) {
                expect(tx[model].deleteMany).not.toHaveBeenCalled();
                expect(tx[model].updateMany).not.toHaveBeenCalled();
            }
        });

        it('revokes the sessions after the transaction', () => {
            expect(sessions.revokeDeletedUser).toHaveBeenCalledWith(
                'resident-1'
            );
        });
    });

    it('admin deletion keeps feedback replies and audit log, drops only unused invitations', async () => {
        db.user.findUnique.mockResolvedValue({
            id: 'admin-1',
            email: 'admin@example.com',
            role: Role.ADMIN,
        });
        db.shop.count.mockResolvedValue(0);

        await service.deleteUser('admin-1');

        expect(tx.feedbackReply.deleteMany).not.toHaveBeenCalled();
        expect(tx.auditLog.deleteMany).not.toHaveBeenCalled();
        expect(tx.invitation.deleteMany).toHaveBeenCalledWith({
            where: { invitedById: 'admin-1', usedAt: null },
        });
        expect(tx.user.update).toHaveBeenCalledWith(
            expect.objectContaining({
                data: expect.objectContaining({ role: Role.GUEST }),
            })
        );
    });

    it('does not revoke sessions when the transaction fails', async () => {
        db.user.findUnique.mockResolvedValue(resident);
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
            email: 'm@example.com',
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

    it('an already-anonymised account is a 404', async () => {
        db.user.findUnique.mockResolvedValue({
            id: 'resident-1',
            email: deletedUserEmail('resident-1'),
            role: Role.GUEST,
        });

        await expect(service.deleteUser('resident-1')).rejects.toBeInstanceOf(
            NotFoundException
        );
        expect(db.$transaction).not.toHaveBeenCalled();
    });

    it('tombstone emails are lower-case and recognised', () => {
        const email = deletedUserEmail('ClxAbC');
        expect(email).toBe('deleted-clxabc@deleted.invalid');
        expect(isDeletedUserEmail(email)).toBe(true);
        expect(isDeletedUserEmail('someone@example.com')).toBe(false);
    });
});

describe('UserService.updateUser avatar URL', () => {
    const STORAGE =
        'https://proj.supabase.co/storage/v1/object/public/eastpark-uploads';
    const db = {
        user: { findUnique: jest.fn(), update: jest.fn() },
    };
    const config = {
        getOrThrow: jest.fn(
            (key: string) =>
                ({
                    'supabase.url': 'https://proj.supabase.co',
                    'supabase.bucket': 'eastpark-uploads',
                })[key]
        ),
    };
    const service = new UserService(
        db as unknown as DatabaseService,
        {} as SessionVersionService,
        {} as HelperEncryptionService,
        config as unknown as ConfigService
    );

    beforeEach(() => {
        jest.clearAllMocks();
        db.user.findUnique.mockResolvedValue({
            id: 'u1',
            avatarUrl: 'https://picsum.photos/legacy.jpg',
        });
        db.user.update.mockResolvedValue({ id: 'u1' });
    });

    it('accepts a new avatar from our bucket', async () => {
        const avatarUrl = `${STORAGE}/user-avatars/u1/1-a.webp`;
        await service.updateUser('u1', { avatarUrl });
        expect(db.user.update).toHaveBeenCalledWith({
            where: { id: 'u1' },
            data: { avatarUrl },
        });
    });

    it('rejects a new external avatar with 400', async () => {
        await expect(
            service.updateUser('u1', {
                avatarUrl: 'https://evil.example/a.jpg',
            })
        ).rejects.toThrow(new BadRequestException('file.error.urlNotStored'));
        expect(db.user.update).not.toHaveBeenCalled();
    });

    it('accepts the stored legacy value re-sent unchanged', async () => {
        await service.updateUser('u1', {
            name: 'New Name',
            avatarUrl: 'https://picsum.photos/legacy.jpg',
        });
        expect(db.user.update).toHaveBeenCalled();
    });

    it('accepts clearing the avatar and updates without an avatar', async () => {
        await service.updateUser('u1', { avatarUrl: null });
        await service.updateUser('u1', { name: 'Only Name' });
        expect(db.user.update).toHaveBeenCalledTimes(2);
        expect(config.getOrThrow).not.toHaveBeenCalled();
    });
});

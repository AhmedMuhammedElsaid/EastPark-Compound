import {
    BadRequestException,
    ConflictException,
    ForbiddenException,
    NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Role } from '@prisma/client';

import { SessionVersionService } from 'src/common/auth/services/session-version.service';
import { DatabaseService } from 'src/common/database/services/database.service';
import { AuditService } from 'src/modules/audit/audit.service';
import {
    deletedUserEmail,
    isDeletedUserEmail,
    UserService,
} from 'src/modules/user/services/user.service';

function buildDeleteDb() {
    return {
        user: { findUnique: jest.fn(), update: jest.fn() },
        shop: { count: jest.fn() },
        $transaction: jest.fn(),
    };
}

describe('UserService.deleteUser (soft delete)', () => {
    const db = buildDeleteDb();
    const sessions = { bump: jest.fn() };
    const audit = { record: jest.fn() };
    const service = new UserService(
        db as unknown as DatabaseService,
        sessions as unknown as SessionVersionService,
        {} as ConfigService,
        audit as unknown as AuditService
    );

    const resident = {
        id: 'resident-1',
        name: 'Sara',
        email: 'resident@example.com',
        role: Role.RESIDENT,
        deletedAt: null,
    };

    beforeEach(() => {
        jest.clearAllMocks();
        sessions.bump.mockResolvedValue(3);
        db.user.update.mockResolvedValue({});
        db.shop.count.mockResolvedValue(0);
    });

    it('refuses to delete a merchant that still owns an active shop', async () => {
        db.user.findUnique.mockResolvedValue({
            id: 'merchant-1',
            email: 'm@example.com',
            role: Role.MERCHANT,
        });
        db.shop.count.mockResolvedValue(1);

        const result = service.deleteUser('merchant-1');
        await expect(result).rejects.toBeInstanceOf(ConflictException);
        await expect(result).rejects.toThrow('user.error.merchantOwnsShop');
        // Only non-deleted shops count.
        expect(db.shop.count).toHaveBeenCalledWith({
            where: { merchantId: 'merchant-1', deletedAt: null },
        });
        expect(db.user.update).not.toHaveBeenCalled();
        expect(sessions.bump).not.toHaveBeenCalled();
    });

    it('self-delete keeps the row: only deletedAt, deletedById (self) and the push token change', async () => {
        db.user.findUnique.mockResolvedValue(resident);

        await expect(
            service.deleteAccount('resident-1')
        ).resolves.toBeUndefined();

        expect(db.user.update).toHaveBeenCalledTimes(1);
        const args = db.user.update.mock.calls[0][0];
        expect(args.where).toEqual({ id: 'resident-1' });
        expect(Object.keys(args.data).sort()).toEqual(
            ['deletedAt', 'deletedById', 'pushToken'].sort()
        );
        expect(args.data.deletedAt).toBeInstanceOf(Date);
        expect(args.data.deletedById).toBe('resident-1');
        expect(args.data.pushToken).toBeNull();
        // No anonymising and no wiping of related data.
        expect(db.$transaction).not.toHaveBeenCalled();
        // No admin actor: AuditService.record ignores it.
        expect(audit.record).toHaveBeenCalledWith(
            undefined,
            'USER_DELETED',
            'User',
            'resident-1',
            expect.anything()
        );
    });

    it('revokes every session: plain bump before the row changes and again after it', async () => {
        db.user.findUnique.mockResolvedValue(resident);
        await service.deleteUser('resident-1');
        expect(sessions.bump).toHaveBeenCalledTimes(2);
        expect(sessions.bump).toHaveBeenNthCalledWith(1, 'resident-1');
        expect(sessions.bump).toHaveBeenNthCalledWith(2, 'resident-1');
        const [before, after] = sessions.bump.mock.invocationCallOrder;
        const update = db.user.update.mock.invocationCallOrder[0];
        // The second bump closes the race with a login/refresh that read the
        // row before deletedAt was set and minted a token after the first bump.
        expect(before).toBeLessThan(update);
        expect(after).toBeGreaterThan(update);
    });

    it('a session-store failure aborts before the account is marked deleted', async () => {
        db.user.findUnique.mockResolvedValue(resident);
        sessions.bump.mockRejectedValue(new Error('redis down'));
        await expect(service.deleteUser('resident-1')).rejects.toThrow(
            'redis down'
        );
        expect(db.user.update).not.toHaveBeenCalled();
    });

    it('unknown user is a 404', async () => {
        db.user.findUnique.mockResolvedValue(null);
        await expect(service.deleteUser('nope')).rejects.toBeInstanceOf(
            NotFoundException
        );
        expect(db.shop.count).not.toHaveBeenCalled();
        expect(db.user.update).not.toHaveBeenCalled();
    });

    it('an already soft-deleted account is a 404', async () => {
        db.user.findUnique.mockResolvedValue({
            ...resident,
            deletedAt: new Date(),
        });
        await expect(service.deleteUser('resident-1')).rejects.toThrow(
            'user.error.notFound'
        );
        expect(db.user.update).not.toHaveBeenCalled();
    });

    it('a legacy anonymised tombstone is a 404', async () => {
        db.user.findUnique.mockResolvedValue({
            id: 'resident-1',
            email: deletedUserEmail('resident-1'),
            role: Role.GUEST,
        });
        await expect(service.deleteUser('resident-1')).rejects.toBeInstanceOf(
            NotFoundException
        );
        expect(db.user.update).not.toHaveBeenCalled();
    });

    it('tombstone emails are lower-case and recognised', () => {
        const email = deletedUserEmail('ClxAbC');
        expect(email).toBe('deleted-clxabc@deleted.invalid');
        expect(isDeletedUserEmail(email)).toBe(true);
        expect(isDeletedUserEmail('someone@example.com')).toBe(false);
    });
});

describe('UserService super-admin protections on delete', () => {
    const db = buildDeleteDb();
    const sessions = { bump: jest.fn() };
    const audit = { record: jest.fn() };
    const service = new UserService(
        db as unknown as DatabaseService,
        sessions as unknown as SessionVersionService,
        {} as ConfigService,
        audit as unknown as AuditService
    );
    const admin = { userId: 'admin-1', role: Role.ADMIN };
    const superAdmin = { userId: 'owner-1', role: Role.SUPER_ADMIN };

    beforeEach(() => {
        jest.clearAllMocks();
        sessions.bump.mockResolvedValue(1);
        db.user.update.mockResolvedValue({});
        db.shop.count.mockResolvedValue(0);
    });

    it('nobody can delete a SUPER_ADMIN (admin, super admin or self-delete)', async () => {
        db.user.findUnique.mockResolvedValue({
            id: 'owner-1',
            name: 'Owner',
            email: 'owner@example.com',
            role: Role.SUPER_ADMIN,
        });
        for (const actor of [admin, superAdmin, undefined]) {
            const result = service.deleteUser('owner-1', actor);
            await expect(result).rejects.toBeInstanceOf(ForbiddenException);
            await expect(result).rejects.toThrow(
                'user.error.cannotChangeSuperAdmin'
            );
        }
        expect(db.user.update).not.toHaveBeenCalled();
        expect(audit.record).not.toHaveBeenCalled();
    });

    it('an ADMIN cannot delete another ADMIN', async () => {
        db.user.findUnique.mockResolvedValue({
            id: 'admin-2',
            name: 'Mahmoud',
            email: 'mahmoud@example.com',
            role: Role.ADMIN,
        });
        const result = service.deleteUser('admin-2', admin);
        await expect(result).rejects.toBeInstanceOf(ForbiddenException);
        await expect(result).rejects.toThrow('user.error.superAdminRequired');
        expect(db.user.update).not.toHaveBeenCalled();
    });

    it('the SUPER_ADMIN soft-deletes an ADMIN: deletedById is the actor, audited', async () => {
        db.user.findUnique.mockResolvedValue({
            id: 'admin-2',
            name: 'Mahmoud',
            email: 'mahmoud@example.com',
            role: Role.ADMIN,
        });
        await expect(
            service.deleteUser('admin-2', superAdmin)
        ).resolves.toEqual({ success: true, message: 'User deleted' });
        expect(db.user.update).toHaveBeenCalledWith({
            where: { id: 'admin-2' },
            data: expect.objectContaining({ deletedById: 'owner-1' }),
        });
        expect(audit.record).toHaveBeenCalledWith(
            superAdmin,
            'USER_DELETED',
            'User',
            'admin-2',
            { label: 'Mahmoud (mahmoud@example.com)', role: Role.ADMIN }
        );
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
        config as unknown as ConfigService,
        { record: jest.fn() } as unknown as AuditService
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

describe('UserService.changeRole', () => {
    const db = {
        user: { findUnique: jest.fn(), update: jest.fn() },
        shop: { count: jest.fn() },
    };
    const sessions = { bump: jest.fn() };
    const audit = { record: jest.fn() };
    const service = new UserService(
        db as unknown as DatabaseService,
        sessions as unknown as SessionVersionService,
        {} as ConfigService,
        audit as unknown as AuditService
    );
    const superAdmin = { userId: 'owner-1', role: Role.SUPER_ADMIN };
    const resident = {
        id: 'u1',
        name: 'Sara',
        email: 'sara@example.com',
        role: Role.RESIDENT,
        unitNumber: 'B1-2-3',
        createdAt: new Date('2026-10-01T00:00:00Z'),
    };

    beforeEach(() => {
        jest.clearAllMocks();
        sessions.bump.mockResolvedValue(1);
        db.shop.count.mockResolvedValue(0);
    });

    it('changes the role, revokes sessions, then writes the audit entry', async () => {
        db.user.findUnique.mockResolvedValue(resident);
        db.user.update.mockResolvedValue({ ...resident, role: Role.ADMIN });

        const result = await service.changeRole('u1', Role.ADMIN, superAdmin);

        expect(result).toEqual({ ...resident, role: Role.ADMIN });
        expect(db.user.update).toHaveBeenCalledWith(
            expect.objectContaining({
                where: { id: 'u1' },
                data: { role: Role.ADMIN },
            })
        );
        expect(sessions.bump).toHaveBeenCalledWith('u1');
        expect(audit.record).toHaveBeenCalledWith(
            superAdmin,
            'USER_ROLE_CHANGED',
            'User',
            'u1',
            {
                label: 'Sara (sara@example.com)',
                fromRole: Role.RESIDENT,
                toRole: Role.ADMIN,
            }
        );
        expect(sessions.bump.mock.invocationCallOrder[0]).toBeLessThan(
            db.user.update.mock.invocationCallOrder[0]
        );
        expect(db.user.update.mock.invocationCallOrder[0]).toBeLessThan(
            audit.record.mock.invocationCallOrder[0]
        );
    });

    it('a session-store failure aborts before the role is written', async () => {
        db.user.findUnique.mockResolvedValue(resident);
        sessions.bump.mockRejectedValue(new Error('redis down'));

        await expect(
            service.changeRole('u1', Role.ADMIN, superAdmin)
        ).rejects.toThrow('redis down');
        expect(db.user.update).not.toHaveBeenCalled();
        expect(audit.record).not.toHaveBeenCalled();
    });

    it('same role is a no-op: no update, no session bump, no audit', async () => {
        db.user.findUnique.mockResolvedValue(resident);
        await expect(
            service.changeRole('u1', Role.RESIDENT, superAdmin)
        ).resolves.toEqual(resident);
        expect(db.user.update).not.toHaveBeenCalled();
        expect(sessions.bump).not.toHaveBeenCalled();
        expect(audit.record).not.toHaveBeenCalled();
    });

    it('a SUPER_ADMIN (including the caller) can never be changed', async () => {
        db.user.findUnique.mockResolvedValue({
            ...resident,
            id: 'owner-1',
            role: Role.SUPER_ADMIN,
        });
        const result = service.changeRole('owner-1', Role.ADMIN, superAdmin);
        await expect(result).rejects.toBeInstanceOf(ForbiddenException);
        await expect(result).rejects.toThrow(
            'user.error.cannotChangeSuperAdmin'
        );
        expect(db.user.update).not.toHaveBeenCalled();
    });

    it('unknown and deleted (tombstone) users are a 404', async () => {
        db.user.findUnique.mockResolvedValueOnce(null);
        await expect(
            service.changeRole('nope', Role.ADMIN, superAdmin)
        ).rejects.toThrow('user.error.notFound');

        db.user.findUnique.mockResolvedValueOnce({
            ...resident,
            email: deletedUserEmail('u1'),
            role: Role.GUEST,
        });
        await expect(
            service.changeRole('u1', Role.ADMIN, superAdmin)
        ).rejects.toBeInstanceOf(NotFoundException);
        expect(db.user.update).not.toHaveBeenCalled();
    });

    it('a soft-deleted user is a 404', async () => {
        db.user.findUnique.mockResolvedValue({
            ...resident,
            deletedAt: new Date(),
        });
        await expect(
            service.changeRole('u1', Role.ADMIN, superAdmin)
        ).rejects.toThrow('user.error.notFound');
        expect(db.user.update).not.toHaveBeenCalled();
    });

    it('a merchant who owns a shop cannot change role (409)', async () => {
        db.user.findUnique.mockResolvedValue({
            ...resident,
            role: Role.MERCHANT,
        });
        db.shop.count.mockResolvedValue(1);
        const result = service.changeRole('u1', Role.RESIDENT, superAdmin);
        await expect(result).rejects.toBeInstanceOf(ConflictException);
        await expect(result).rejects.toThrow('user.error.merchantOwnsShop');
        expect(db.user.update).not.toHaveBeenCalled();
    });
});

describe('UserService.listUsers', () => {
    const db = { user: { findMany: jest.fn() } };
    const service = new UserService(
        db as unknown as DatabaseService,
        {} as SessionVersionService,
        {} as ConfigService,
        { record: jest.fn() } as unknown as AuditService
    );

    beforeEach(() => jest.clearAllMocks());

    it('searches name/email case-insensitively, filters role, hides tombstones and private fields', async () => {
        db.user.findMany.mockResolvedValue([
            { id: 'a', residentUnits: [] },
            { id: 'b', residentUnits: [] },
        ]);
        const page = await service.listUsers({
            q: 'sar',
            role: Role.RESIDENT,
            limit: 1,
        });
        const args = db.user.findMany.mock.calls[0][0];
        expect(args.where).toEqual({
            deletedAt: null,
            NOT: { email: { endsWith: '@deleted.invalid' } },
            role: Role.RESIDENT,
            OR: [
                { name: { contains: 'sar', mode: 'insensitive' } },
                { email: { contains: 'sar', mode: 'insensitive' } },
            ],
        });
        expect(args.take).toBe(2);
        expect(args.orderBy).toEqual([{ createdAt: 'desc' }, { id: 'desc' }]);
        expect(args.select).toEqual({
            id: true,
            name: true,
            email: true,
            role: true,
            unitNumber: true,
            createdAt: true,
            residentUnits: {
                select: {
                    id: true,
                    building: true,
                    floor: true,
                    flatNumber: true,
                    createdAt: true,
                },
                orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
            },
        });
        expect(page).toEqual({
            items: [{ id: 'a', units: [] }],
            nextCursor: 'a',
        });
    });
});

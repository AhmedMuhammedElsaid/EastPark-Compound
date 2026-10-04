import {
    ConflictException,
    ForbiddenException,
    Injectable,
    NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Prisma, Role } from '@prisma/client';
import { randomBytes } from 'node:crypto';

import { SessionVersionService } from 'src/common/auth/services/session-version.service';
import { isSuperAdmin } from 'src/common/auth/utils/roles';
import { DatabaseService } from 'src/common/database/services/database.service';
import { assertStoragePublicUrls } from 'src/common/file/storage-url';
import { HelperEncryptionService } from 'src/common/helper/services/helper.encryption.service';
import { cursorArgs, toCursorPage } from 'src/common/helper/pagination';
import { IAuthUser } from 'src/common/request/interfaces/request.interface';
import { ApiGenericResponseDto } from 'src/common/response/dtos/response.generic.dto';
import { AuditService } from 'src/modules/audit/audit.service';

import {
    AdminUserQueryDto,
    AssignableRole,
} from '../dtos/request/user.admin.request';
import { UserUpdateDto } from '../dtos/request/user.update.request';
import {
    AdminUserItemDto,
    AdminUserListResponseDto,
} from '../dtos/response/user.admin.response';
import {
    UserGetProfileResponseDto,
    UserUpdateProfileResponseDto,
} from '../dtos/response/user.response';

/** Display name every anonymised (deleted) account carries. */
export const DELETED_USER_NAME = 'Deleted user';
/** Reserved TLD (RFC 2606): unique per account, never deliverable. */
const DELETED_USER_EMAIL_DOMAIN = '@deleted.invalid';

export const deletedUserEmail = (userId: string): string =>
    `deleted-${userId.toLowerCase()}${DELETED_USER_EMAIL_DOMAIN}`;

export const isDeletedUserEmail = (email: string): boolean =>
    email.endsWith(DELETED_USER_EMAIL_DOMAIN);

const ADMIN_USER_SELECT = {
    id: true,
    name: true,
    email: true,
    role: true,
    unitNumber: true,
    createdAt: true,
} satisfies Prisma.UserSelect;

const userLabel = (user: { name: string; email: string }): string =>
    `${user.name} (${user.email})`;

@Injectable()
export class UserService {
    constructor(
        private readonly db: DatabaseService,
        private readonly sessions: SessionVersionService,
        private readonly encryption: HelperEncryptionService,
        private readonly config: ConfigService,
        private readonly audit: AuditService
    ) {}

    async getProfile(userId: string): Promise<UserGetProfileResponseDto> {
        const user = await this.db.user.findUnique({ where: { id: userId } });
        if (!user) throw new NotFoundException('User not found');
        return user;
    }

    async updateUser(
        userId: string,
        data: UserUpdateDto
    ): Promise<UserUpdateProfileResponseDto> {
        const user = await this.db.user.findUnique({ where: { id: userId } });
        if (!user) throw new NotFoundException('User not found');

        // A new avatar must be a file uploaded to our storage. Re-sending the
        // stored value unchanged (clients save the whole form) and clearing it
        // (null) are always allowed, so legacy external avatars keep working.
        if (data.avatarUrl && data.avatarUrl !== user.avatarUrl) {
            assertStoragePublicUrls(
                this.config,
                [data.avatarUrl],
                'file.error.urlNotStored'
            );
        }

        return this.db.user.update({ where: { id: userId }, data });
    }

    /**
     * Deletes an account (self-delete and admin delete) by anonymising it in place.
     *
     * The user row is kept as a per-account tombstone and every piece of personal
     * data on it is overwritten. Records that other people or the business depend
     * on stay attached to that tombstone, so no foreign key changes and no
     * migration is needed:
     * - orders and order items: the shop's sales history (names/prices snapshotted);
     * - review ratings: the shop's average keeps its contribution (the free-text
     *   comment is cleared);
     * - poll and election votes: closed results must not change retroactively.
     *   Votes are only ever reported as tallies, and the tombstone id no longer
     *   identifies anyone;
     * - feedback: kept for the administration, forced anonymous;
     * - an admin's feedback replies, audit log entries and used invitations.
     * Purely personal data is deleted: notifications, notification preferences,
     * saved shops, announcement comments and unused invitations (so a deleted
     * admin's invite links stop working). A per-user tombstone (not one shared
     * "deleted user") is required because votes and reviews are unique per user.
     *
     * A merchant that still owns a shop is refused with 409: the shop has to be
     * removed or reassigned first through the shops module.
     *
     * A SUPER_ADMIN can never be deleted (403 `user.error.cannotChangeSuperAdmin`).
     * When `actor` is given (admin delete), deleting an ADMIN needs a SUPER_ADMIN
     * actor (403 `user.error.superAdminRequired`) and the deletion is audited.
     */
    async deleteUser(
        userId: string,
        actor?: IAuthUser
    ): Promise<ApiGenericResponseDto> {
        const user = await this.db.user.findUnique({ where: { id: userId } });
        if (!user || isDeletedUserEmail(user.email))
            throw new NotFoundException('User not found');

        if (user.role === Role.SUPER_ADMIN)
            throw new ForbiddenException('user.error.cannotChangeSuperAdmin');
        if (actor && user.role === Role.ADMIN && !isSuperAdmin(actor.role))
            throw new ForbiddenException('user.error.superAdminRequired');

        const ownedShops = await this.db.shop.count({
            where: { merchantId: userId },
        });
        if (ownedShops > 0) {
            throw new ConflictException('user.error.merchantOwnsShop');
        }

        // A real argon2 hash of a secret nobody keeps: login fails with 401
        // (a malformed hash would make argon2.verify throw a 500 instead).
        const passwordHash = await this.encryption.createHash(
            randomBytes(32).toString('hex')
        );

        await this.db.$transaction(async tx => {
            // 1. Purely personal data
            await tx.notificationPreference.deleteMany({ where: { userId } });
            await tx.notification.deleteMany({ where: { userId } });
            await tx.savedShop.deleteMany({ where: { userId } });
            await tx.comment.deleteMany({ where: { userId } });
            await tx.invitation.deleteMany({
                where: { invitedById: userId, usedAt: null },
            });

            // 2. Records others rely on: keep, strip the personal parts
            await tx.review.updateMany({
                where: { userId },
                data: { comment: null },
            });
            await tx.feedback.updateMany({
                where: { userId },
                data: { isAnonymous: true },
            });
            await tx.residentLead.updateMany({
                where: { userId },
                data: { userId: null },
            });

            // 3. Anonymise the account row itself
            await tx.user.update({
                where: { id: userId },
                data: {
                    name: DELETED_USER_NAME,
                    email: deletedUserEmail(userId),
                    phone: null,
                    unitNumber: null,
                    avatarUrl: null,
                    pushToken: null,
                    passwordHash,
                    isVerified: false,
                    role: Role.GUEST,
                },
            });
        });

        // Tokens already issued to the deleted account must stop working now,
        // not when they expire. (Refresh also rejects unverified accounts.)
        await this.sessions.revokeDeletedUser(userId);

        // Label from the row read before anonymisation, not the tombstone.
        await this.audit.record(actor, 'USER_DELETED', 'User', userId, {
            label: userLabel(user),
            role: user.role,
        });

        return { success: true, message: 'User deleted' };
    }

    /** `GET /admin/user` [SUPER_ADMIN] — team & roles search. */
    async listUsers(
        query: AdminUserQueryDto
    ): Promise<AdminUserListResponseDto> {
        const limit = query.limit ?? 20;
        const where: Prisma.UserWhereInput = {
            NOT: { email: { endsWith: DELETED_USER_EMAIL_DOMAIN } },
            ...(query.role ? { role: query.role } : {}),
            ...(query.q
                ? {
                      OR: [
                          {
                              name: {
                                  contains: query.q,
                                  mode: 'insensitive',
                              },
                          },
                          {
                              email: {
                                  contains: query.q,
                                  mode: 'insensitive',
                              },
                          },
                      ],
                  }
                : {}),
        };
        const rows = await this.db.user.findMany({
            where,
            take: limit + 1,
            ...cursorArgs(query.cursor),
            orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
            select: ADMIN_USER_SELECT,
        });
        return toCursorPage(rows, limit);
    }

    /**
     * `PATCH /admin/user/:id/role` [SUPER_ADMIN]. A SUPER_ADMIN (including the
     * caller) can never be changed, and no value grants SUPER_ADMIN (DTO). On a
     * real change every session of the target is revoked, so the new role is
     * in force immediately (the access token carries the role).
     */
    async changeRole(
        userId: string,
        role: AssignableRole,
        actor: IAuthUser
    ): Promise<AdminUserItemDto> {
        const user = await this.db.user.findUnique({
            where: { id: userId },
            select: ADMIN_USER_SELECT,
        });
        if (!user || isDeletedUserEmail(user.email))
            throw new NotFoundException('user.error.notFound');
        if (user.role === Role.SUPER_ADMIN)
            throw new ForbiddenException('user.error.cannotChangeSuperAdmin');
        if (user.role === role) return user;

        if (user.role === Role.MERCHANT) {
            const ownedShops = await this.db.shop.count({
                where: { merchantId: userId },
            });
            if (ownedShops > 0)
                throw new ConflictException('user.error.merchantOwnsShop');
        }

        const updated = await this.db.user.update({
            where: { id: userId },
            data: { role },
            select: ADMIN_USER_SELECT,
        });

        await this.sessions.bump(userId);

        await this.audit.record(actor, 'USER_ROLE_CHANGED', 'User', userId, {
            label: userLabel(updated),
            fromRole: user.role,
            toRole: updated.role,
        });

        return updated;
    }

    async deleteAccount(userId: string): Promise<void> {
        await this.deleteUser(userId);
    }
}

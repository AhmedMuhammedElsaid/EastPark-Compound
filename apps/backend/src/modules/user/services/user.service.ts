import {
    ConflictException,
    Injectable,
    NotFoundException,
} from '@nestjs/common';
import { Role } from '@prisma/client';
import { randomBytes } from 'node:crypto';

import { SessionVersionService } from 'src/common/auth/services/session-version.service';
import { DatabaseService } from 'src/common/database/services/database.service';
import { HelperEncryptionService } from 'src/common/helper/services/helper.encryption.service';
import { ApiGenericResponseDto } from 'src/common/response/dtos/response.generic.dto';

import { UserUpdateDto } from '../dtos/request/user.update.request';
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

@Injectable()
export class UserService {
    constructor(
        private readonly db: DatabaseService,
        private readonly sessions: SessionVersionService,
        private readonly encryption: HelperEncryptionService
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
     */
    async deleteUser(userId: string): Promise<ApiGenericResponseDto> {
        const user = await this.db.user.findUnique({ where: { id: userId } });
        if (!user || isDeletedUserEmail(user.email))
            throw new NotFoundException('User not found');

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

        return { success: true, message: 'User deleted' };
    }

    async deleteAccount(userId: string): Promise<void> {
        await this.deleteUser(userId);
    }
}

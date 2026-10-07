import {
    BadRequestException,
    ConflictException,
    ForbiddenException,
    Injectable,
    NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Prisma, Role } from '@prisma/client';

import { SessionVersionService } from 'src/common/auth/services/session-version.service';
import { isSuperAdmin } from 'src/common/auth/utils/roles';
import { DatabaseService } from 'src/common/database/services/database.service';
import { assertStoragePublicUrls } from 'src/common/file/storage-url';
import { cursorArgs, toCursorPage } from 'src/common/helper/pagination';
import { formatUnitLabel } from 'src/common/helper/utils/unit-label';
import { IAuthUser } from 'src/common/request/interfaces/request.interface';
import { ApiGenericResponseDto } from 'src/common/response/dtos/response.generic.dto';
import { AuditService } from 'src/modules/audit/audit.service';
import {
    RESIDENT_UNIT_ORDER,
    RESIDENT_UNIT_SELECT,
    toResidentUnitDto,
} from 'src/modules/units/dtos/resident-unit.dto';

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

/**
 * Legacy tombstones: before soft delete (2026-10-05) a deleted account was
 * anonymised in place to this name/email. Those rows are marked deleted by the
 * soft-delete migration and are never restorable.
 */
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

/** Owned flats, oldest first (`ResidentUnitDto` after mapping). */
const UNITS_SELECT = {
    residentUnits: {
        select: RESIDENT_UNIT_SELECT,
        orderBy: RESIDENT_UNIT_ORDER,
    },
} satisfies Prisma.UserSelect;

const userLabel = (user: { name: string; email: string }): string =>
    `${user.name} (${user.email})`;

@Injectable()
export class UserService {
    constructor(
        private readonly db: DatabaseService,
        private readonly sessions: SessionVersionService,
        private readonly config: ConfigService,
        private readonly audit: AuditService
    ) {}

    async getProfile(userId: string): Promise<UserGetProfileResponseDto> {
        const user = await this.db.user.findUnique({
            where: { id: userId },
            include: UNITS_SELECT,
        });
        if (!user || user.deletedAt) throw new NotFoundException('User not found');
        const { residentUnits, ...profile } = user;
        return { ...profile, units: residentUnits.map(toResidentUnitDto) };
    }

    async updateUser(
        userId: string,
        data: UserUpdateDto
    ): Promise<UserUpdateProfileResponseDto> {
        const user = await this.db.user.findUnique({ where: { id: userId } });
        if (!user || user.deletedAt) throw new NotFoundException('User not found');

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

        const update: UserUpdateDto = { ...data };
        if (update.unitNumber !== undefined) {
            const primary = await this.resolvePrimaryUnit(
                userId,
                user.unitNumber,
                update.unitNumber
            );
            if (primary === undefined) delete update.unitNumber;
            else update.unitNumber = primary;
        }

        return this.db.user.update({ where: { id: userId }, data: update });
    }

    /**
     * `unitNumber` on `PUT /user` only chooses the PRIMARY flat. Unchanged
     * (after trim; '' and null both mean "none") is always accepted — old
     * mobile builds send the whole form — and returns `undefined` (no write).
     * Otherwise it must be one of the caller's flat labels; anything else,
     * including clearing it while flats are owned, is 400
     * `user.error.unitNotOwned`. Legacy accounts (no flats) can only resend it.
     */
    private async resolvePrimaryUnit(
        userId: string,
        current: string | null,
        requested: string | null
    ): Promise<string | undefined> {
        const normalize = (value: string | null): string | null =>
            typeof value === 'string' && value.trim() !== ''
                ? value.trim()
                : null;
        const wanted = normalize(requested);
        if (wanted === normalize(current)) return undefined;

        if (wanted !== null) {
            const units = await this.db.residentUnit.findMany({
                where: { userId },
                select: { building: true, floor: true, flatNumber: true },
            });
            if (units.some(unit => formatUnitLabel(unit) === wanted))
                return wanted;
        }
        throw new BadRequestException('user.error.unitNotOwned');
    }

    /**
     * Soft-deletes an account (self-delete and admin delete). The row stays and
     * only `deletedAt`/`deletedById` are set, so the SUPER_ADMIN can restore it
     * from the recycle bin. Everything attached to the account (orders, votes,
     * feedback, reviews, comments, audit entries) stays as it is; reads hide the
     * account itself (login 401, refresh 401, lists, lookups) and its email
     * stays reserved (invite / approve / accept → 409 `user.error.accountDeleted`).
     * Every session is revoked at once and the push token is detached.
     *
     * A merchant that still owns an active (non-deleted) shop is refused with
     * 409: the shop has to be removed first through the shops module.
     *
     * A SUPER_ADMIN can never be deleted (403 `user.error.cannotChangeSuperAdmin`).
     * When `actor` is given (admin delete, SUPER_ADMIN-only route), deleting an
     * ADMIN needs a SUPER_ADMIN actor (403 `user.error.superAdminRequired`) and
     * the deletion is audited. Legacy anonymised tombstones are already deleted.
     */
    async deleteUser(
        userId: string,
        actor?: IAuthUser
    ): Promise<ApiGenericResponseDto> {
        const user = await this.db.user.findUnique({ where: { id: userId } });
        if (!user || user.deletedAt || isDeletedUserEmail(user.email))
            throw new NotFoundException('user.error.notFound');

        if (user.role === Role.SUPER_ADMIN)
            throw new ForbiddenException('user.error.cannotChangeSuperAdmin');
        if (actor && user.role === Role.ADMIN && !isSuperAdmin(actor.role))
            throw new ForbiddenException('user.error.superAdminRequired');

        const ownedShops = await this.db.shop.count({
            where: { merchantId: userId, deletedAt: null },
        });
        if (ownedShops > 0) {
            throw new ConflictException('user.error.merchantOwnsShop');
        }

        // Revoke first: if Redis is down this throws (503) before the row
        // changes, so a retry is not a 404 that leaves live sessions behind.
        // A plain bump (no TTL): the account can be restored, and an expiring
        // key would later reset the version below tokens minted after restore.
        await this.sessions.bump(userId);

        await this.db.user.update({
            where: { id: userId },
            data: {
                deletedAt: new Date(),
                deletedById: actor?.userId ?? userId,
                pushToken: null,
            },
        });

        await this.audit.record(actor, 'USER_DELETED', 'User', userId, {
            label: userLabel(user),
            role: user.role,
        });

        // Bump again now that deletedAt is set: a login or refresh that read
        // the row before the update could have minted a token at the first
        // bumped version after it; this second bump makes that token stale.
        await this.sessions.bump(userId);

        return { success: true, message: 'User deleted' };
    }

    /** `GET /admin/user` [SUPER_ADMIN] — team & roles search. */
    async listUsers(
        query: AdminUserQueryDto
    ): Promise<AdminUserListResponseDto> {
        const limit = query.limit ?? 20;
        const where: Prisma.UserWhereInput = {
            deletedAt: null,
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
            select: { ...ADMIN_USER_SELECT, ...UNITS_SELECT },
        });
        const { items, nextCursor } = toCursorPage(rows, limit);
        return {
            items: items.map(({ residentUnits, ...user }) => ({
                ...user,
                units: residentUnits.map(toResidentUnitDto),
            })),
            nextCursor,
        };
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
        const found = await this.db.user.findUnique({
            where: { id: userId },
            select: { ...ADMIN_USER_SELECT, deletedAt: true },
        });
        if (!found || found.deletedAt || isDeletedUserEmail(found.email))
            throw new NotFoundException('user.error.notFound');
        const { deletedAt: _deletedAt, ...user } = found;
        if (user.role === Role.SUPER_ADMIN)
            throw new ForbiddenException('user.error.cannotChangeSuperAdmin');
        if (user.role === role) return user;

        if (user.role === Role.MERCHANT) {
            const ownedShops = await this.db.shop.count({
                where: { merchantId: userId, deletedAt: null },
            });
            if (ownedShops > 0)
                throw new ConflictException('user.error.merchantOwnsShop');
        }

        // Revoke first: if Redis is down this throws before the role changes,
        // so a retry is not a same-role no-op that skips the revoke and audit.
        await this.sessions.bump(userId);

        const updated = await this.db.user.update({
            where: { id: userId },
            data: { role },
            select: ADMIN_USER_SELECT,
        });

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

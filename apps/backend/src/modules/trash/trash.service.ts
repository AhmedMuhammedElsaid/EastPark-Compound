import {
    ConflictException,
    Injectable,
    NotFoundException,
} from '@nestjs/common';

import {
    isPrismaError,
    PRISMA_RECORD_NOT_FOUND,
} from 'src/common/database/prisma-errors';
import { DatabaseService } from 'src/common/database/services/database.service';
import { cursorArgs, toCursorPage } from 'src/common/helper/pagination';
import { IAuthUser } from 'src/common/request/interfaces/request.interface';
import { AuditAction, AuditEntity } from 'src/modules/audit/audit.actions';
import { AuditService } from 'src/modules/audit/audit.service';
import { isDeletedUserEmail } from 'src/modules/user/services/user.service';

import { TrashQueryDto, TrashType } from './dtos/trash.request.dto';
import { TrashItemDto, TrashListResponseDto } from './dtos/trash.response.dto';

export const TRASH_REASON = {
    notRestorable: 'user.error.notRestorable',
    parentDeleted: 'trash.error.parentDeleted',
    conflict: 'trash.error.conflict',
} as const;

const DELETED_BY = { select: { id: true, name: true } } as const;
const PARENT_SHOP = { select: { name: true, deletedAt: true } } as const;
const REVIEW_SELECT = {
    id: true,
    rating: true,
    comment: true,
    userId: true,
    shopId: true,
    deletedAt: true,
    deletedBy: DELETED_BY,
    user: { select: { name: true } },
    shop: PARENT_SHOP,
} as const;
const DELETED_FIRST = [{ deletedAt: 'desc' }, { id: 'desc' }] as const;

const AUDIT: Record<TrashType, { action: AuditAction; entity: AuditEntity }> =
    {
        USER: { action: 'USER_RESTORED', entity: 'User' },
        SHOP: { action: 'SHOP_RESTORED', entity: 'Shop' },
        SHOP_PHOTO: { action: 'SHOP_PHOTO_RESTORED', entity: 'ShopPhoto' },
        PRODUCT: { action: 'PRODUCT_RESTORED', entity: 'Product' },
        REVIEW: { action: 'REVIEW_RESTORED', entity: 'Review' },
    };

interface Deleted {
    id: string;
    deletedAt: Date | null;
    deletedBy: { id: string; name: string } | null;
}

interface UserRow extends Deleted {
    name: string;
    email: string;
    role: string;
    unitNumber: string | null;
}
interface ShopRow extends Deleted {
    name: string;
    nameAr: string;
}
interface PhotoRow extends Deleted {
    url: string;
    shop: { name: string; deletedAt: Date | null };
}
interface ProductRow extends Deleted {
    name: string;
    nameAr: string;
    shop: { name: string; deletedAt: Date | null };
}
interface ReviewRow extends Deleted {
    rating: number;
    comment: string | null;
    userId: string;
    shopId: string;
    user: { name: string };
    shop: { name: string; deletedAt: Date | null };
}

function item(
    type: TrashType,
    row: Deleted,
    label: string,
    sublabel: string | null,
    reason: string | null
): TrashItemDto {
    return {
        type,
        id: row.id,
        label,
        sublabel,
        deletedAt: row.deletedAt,
        deletedBy: row.deletedBy
            ? { id: row.deletedBy.id, name: row.deletedBy.name }
            : null,
        restorable: reason === null,
        reason,
    };
}

const toUserItem = (r: UserRow): TrashItemDto =>
    item(
        'USER',
        r,
        `${r.name} (${r.email})`,
        [r.role, r.unitNumber].filter(Boolean).join(' · ') || null,
        isDeletedUserEmail(r.email) ? TRASH_REASON.notRestorable : null
    );

const toShopItem = (r: ShopRow): TrashItemDto =>
    item('SHOP', r, r.name, r.nameAr || null, null);

const parentReason = (shop: { deletedAt: Date | null }): string | null =>
    shop.deletedAt ? TRASH_REASON.parentDeleted : null;

const toPhotoItem = (r: PhotoRow): TrashItemDto =>
    item('SHOP_PHOTO', r, `${r.shop.name} photo`, r.url, parentReason(r.shop));

const toProductItem = (r: ProductRow): TrashItemDto =>
    item(
        'PRODUCT',
        r,
        `${r.name} — ${r.shop.name}`,
        r.nameAr || null,
        parentReason(r.shop)
    );

const toReviewItem = (r: ReviewRow): TrashItemDto =>
    item(
        'REVIEW',
        r,
        `${r.rating}★ by ${r.user.name} — ${r.shop.name}`,
        r.comment || null,
        parentReason(r.shop)
    );

/**
 * Recycle bin (SUPER_ADMIN only). Lists soft-deleted records per type, newest
 * deletion first, and restores them. A restore is refused (409) when it would
 * resurrect a child of a deleted shop, a legacy anonymised account, or a
 * second live review of the same user for the same shop.
 */
@Injectable()
export class TrashService {
    constructor(
        private readonly db: DatabaseService,
        private readonly audit: AuditService
    ) {}

    async list(query: TrashQueryDto): Promise<TrashListResponseDto> {
        const limit = query.limit ?? 20;
        const page = {
            where: { deletedAt: { not: null } },
            take: limit + 1,
            ...cursorArgs(query.cursor),
            orderBy: [...DELETED_FIRST],
        };

        switch (query.type) {
            case 'USER': {
                const rows = await this.db.user.findMany({
                    ...page,
                    select: {
                        id: true,
                        name: true,
                        email: true,
                        role: true,
                        unitNumber: true,
                        deletedAt: true,
                        deletedBy: DELETED_BY,
                    },
                });
                return this.page(rows, limit, toUserItem);
            }
            case 'SHOP': {
                const rows = await this.db.shop.findMany({
                    ...page,
                    select: {
                        id: true,
                        name: true,
                        nameAr: true,
                        deletedAt: true,
                        deletedBy: DELETED_BY,
                    },
                });
                return this.page(rows, limit, toShopItem);
            }
            case 'SHOP_PHOTO': {
                const rows = await this.db.shopPhoto.findMany({
                    ...page,
                    select: {
                        id: true,
                        url: true,
                        deletedAt: true,
                        deletedBy: DELETED_BY,
                        shop: PARENT_SHOP,
                    },
                });
                return this.page(rows, limit, toPhotoItem);
            }
            case 'PRODUCT': {
                const rows = await this.db.product.findMany({
                    ...page,
                    select: {
                        id: true,
                        name: true,
                        nameAr: true,
                        deletedAt: true,
                        deletedBy: DELETED_BY,
                        shop: PARENT_SHOP,
                    },
                });
                return this.page(rows, limit, toProductItem);
            }
            case 'REVIEW': {
                const rows = await this.db.review.findMany({
                    ...page,
                    select: REVIEW_SELECT,
                });
                return this.page(rows, limit, toReviewItem);
            }
        }
    }

    async restore(
        type: TrashType,
        id: string,
        actor: IAuthUser
    ): Promise<TrashItemDto> {
        let restored: TrashItemDto;
        switch (type) {
            case 'USER':
                restored = await this.restoreUser(id);
                break;
            case 'SHOP':
                restored = await this.restoreShop(id);
                break;
            case 'SHOP_PHOTO':
                restored = await this.restorePhoto(id);
                break;
            case 'PRODUCT':
                restored = await this.restoreProduct(id);
                break;
            case 'REVIEW':
                restored = await this.restoreReview(id);
                break;
        }

        const { action, entity } = AUDIT[type];
        await this.audit.record(actor, action, entity, id, {
            label: restored.label,
        });
        return restored;
    }

    // ── Per-type restore ──────────────────────────────────────────────────────

    private async restoreUser(id: string): Promise<TrashItemDto> {
        const row = await this.db.user.findUnique({
            where: { id },
            select: {
                id: true,
                name: true,
                email: true,
                role: true,
                unitNumber: true,
                deletedAt: true,
                deletedBy: DELETED_BY,
            },
        });
        const current = this.assertDeleted(row, toUserItem);
        await this.clear(() =>
            this.db.user.update({
                where: { id, deletedAt: { not: null } },
                data: { deletedAt: null, deletedById: null },
            })
        );
        return this.asRestored(current);
    }

    private async restoreShop(id: string): Promise<TrashItemDto> {
        const row = await this.db.shop.findUnique({
            where: { id },
            select: {
                id: true,
                name: true,
                nameAr: true,
                deletedAt: true,
                deletedBy: DELETED_BY,
            },
        });
        const current = this.assertDeleted(row, toShopItem);
        await this.clear(() =>
            this.db.shop.update({
                where: { id, deletedAt: { not: null } },
                data: { deletedAt: null, deletedById: null },
            })
        );
        return this.asRestored(current);
    }

    private async restorePhoto(id: string): Promise<TrashItemDto> {
        const row = await this.db.shopPhoto.findUnique({
            where: { id },
            select: {
                id: true,
                url: true,
                deletedAt: true,
                deletedBy: DELETED_BY,
                shop: PARENT_SHOP,
            },
        });
        const current = this.assertDeleted(row, toPhotoItem);
        await this.clear(() =>
            this.db.shopPhoto.update({
                where: { id, deletedAt: { not: null } },
                data: { deletedAt: null, deletedById: null },
            })
        );
        return this.asRestored(current);
    }

    private async restoreProduct(id: string): Promise<TrashItemDto> {
        const row = await this.db.product.findUnique({
            where: { id },
            select: {
                id: true,
                name: true,
                nameAr: true,
                deletedAt: true,
                deletedBy: DELETED_BY,
                shop: PARENT_SHOP,
            },
        });
        const current = this.assertDeleted(row, toProductItem);
        await this.clear(() =>
            this.db.product.update({
                where: { id, deletedAt: { not: null } },
                data: { isDeleted: false, deletedAt: null, deletedById: null },
            })
        );
        return this.asRestored(current);
    }

    private async restoreReview(id: string): Promise<TrashItemDto> {
        const row = await this.db.review.findUnique({
            where: { id },
            select: REVIEW_SELECT,
        });
        const current = this.assertDeleted(row, toReviewItem);
        // One live review per user and shop. The @@unique([userId, shopId])
        // already makes a second row impossible; kept as a guard in case that
        // constraint ever changes.
        const live = await this.db.review.findFirst({
            where: {
                userId: row!.userId,
                shopId: row!.shopId,
                deletedAt: null,
                id: { not: id },
            },
            select: { id: true },
        });
        if (live) throw new ConflictException(TRASH_REASON.conflict);
        await this.clear(() =>
            this.db.review.update({
                where: { id, deletedAt: { not: null } },
                data: { deletedAt: null, deletedById: null },
            })
        );
        return this.asRestored(current);
    }

    // ── Helpers ───────────────────────────────────────────────────────────────

    private page<T extends { id: string }>(
        rows: T[],
        limit: number,
        toItem: (row: T) => TrashItemDto
    ): TrashListResponseDto {
        const { items, nextCursor } = toCursorPage(rows, limit);
        return { items: items.map(toItem), nextCursor };
    }

    /** 404 unless the row exists and is deleted; 409 when not restorable. */
    private assertDeleted<T extends Deleted>(
        row: T | null,
        toItem: (row: T) => TrashItemDto
    ): TrashItemDto {
        if (!row || !row.deletedAt)
            throw new NotFoundException('trash.error.notFound');
        const current = toItem(row);
        if (current.reason) throw new ConflictException(current.reason);
        return current;
    }

    /**
     * Compare-and-set: the update only matches a row that is still deleted,
     * so two concurrent restores cannot both succeed (and audit twice).
     */
    private async clear(update: () => Promise<unknown>): Promise<void> {
        try {
            await update();
        } catch (error) {
            if (isPrismaError(error, PRISMA_RECORD_NOT_FOUND))
                throw new NotFoundException('trash.error.notFound');
            throw error;
        }
    }

    private asRestored(current: TrashItemDto): TrashItemDto {
        return {
            ...current,
            deletedAt: null,
            deletedBy: null,
            restorable: true,
            reason: null,
        };
    }
}


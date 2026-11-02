import { Injectable, NotFoundException } from '@nestjs/common';
import { ChargeKind, Prisma } from '@prisma/client';

import {
    cairoToday,
    dateOnlyString,
    OWNERSHIP_SENTINEL_DATE,
    parseDateOnly,
} from 'src/common/finance/cairo-date';
import { DatabaseService } from 'src/common/database/services/database.service';
import { toMoneyNumber } from 'src/common/helper/money';

import { FinanceFlatsQueryDto } from './dtos/request/finance-query.dto';
import {
    FinanceFlatDetailDto,
    FinanceFlatPageDto,
    FinanceFlatTotalsDto,
    FinanceOwnershipListDto,
} from './dtos/response/finance.response.dto';
import { compareFlats } from './finance.mapper';
import { FlatFinanceSummary, summariseFlats } from './kernel/ledger';

const FLAT_SELECT = {
    id: true,
    label: true,
    building: true,
    floor: true,
    flatNumber: true,
    phase: true,
    isActive: true,
} satisfies Prisma.FlatSelect;

type FlatRow = Prisma.FlatGetPayload<{ select: typeof FLAT_SELECT }>;

function totals(summary: FlatFinanceSummary): FinanceFlatTotalsDto {
    return {
        balance: toMoneyNumber(summary.balance),
        credit: toMoneyNumber(summary.credit),
        availableCredit: toMoneyNumber(summary.availableCredit),
        overdueAmount: toMoneyNumber(summary.overdueAmount),
        oldestDueDays: summary.oldestDueDays,
    };
}

/**
 * Flat registry reads for the finance desk (plan 7.1). The accountant sees the
 * owner's name and phone for collection, never email or identity documents.
 */
@Injectable()
export class FinanceFlatsService {
    constructor(private readonly db: DatabaseService) {}

    /**
     * `GET /finance/flats`. The compound has about 690 flats, so the matching
     * flats are sorted in layout order in memory and paged by flat id; the
     * figures are computed for the page only, or for every candidate when a
     * figure filter (`hasBalance`, `overdueDays`) is set.
     */
    async list(query: FinanceFlatsQueryDto): Promise<FinanceFlatPageDto> {
        const limit = query.limit ?? 20;
        const asOf = query.asOf ? parseDateOnly(query.asOf) : cairoToday();
        const where: Prisma.FlatWhereInput = {
            ...(query.q
                ? { label: { contains: query.q, mode: 'insensitive' } }
                : {}),
            ...(query.building ? { building: query.building } : {}),
            ...(query.phase ? { phase: query.phase } : {}),
        };
        const flats = (
            await this.db.flat.findMany({ where, select: FLAT_SELECT })
        ).sort(compareFlats);

        const start = query.cursor
            ? flats.findIndex(f => f.id === query.cursor) + 1
            : 0;
        const rest = flats.slice(start);
        const filtered =
            query.hasBalance !== undefined || query.overdueDays !== undefined;

        let page: FlatRow[];
        let summaries: Map<string, FlatFinanceSummary>;
        let hasMore: boolean;
        if (filtered) {
            summaries = await summariseFlats(
                this.db,
                rest.map(f => f.id),
                asOf
            );
            const matching = rest.filter(f => {
                const s = summaries.get(f.id);
                if (!s) return false;
                if (query.hasBalance === true && !s.balance.gt(0)) return false;
                if (query.hasBalance === false && s.balance.gt(0)) return false;
                if (
                    query.overdueDays !== undefined &&
                    (s.oldestDueDays ?? -1) < query.overdueDays
                )
                    return false;
                return true;
            });
            page = matching.slice(0, limit);
            hasMore = matching.length > limit;
        } else {
            page = rest.slice(0, limit);
            hasMore = rest.length > limit;
            summaries = await summariseFlats(
                this.db,
                page.map(f => f.id),
                asOf
            );
        }

        const owners = await this.currentOwners(page.map(f => f.id));
        const items = page.map(f => {
            const summary = summaries.get(f.id);
            const owner = owners.get(f.id);
            return {
                ...f,
                ownerName: owner?.name ?? null,
                hasAccount: owner !== undefined,
                ...(summary
                    ? totals(summary)
                    : {
                          balance: 0,
                          credit: 0,
                          availableCredit: 0,
                          overdueAmount: 0,
                          oldestDueDays: null,
                      }),
            };
        });
        const last = page[page.length - 1];
        return {
            asOf: dateOnlyString(asOf),
            items,
            ...(hasMore && last ? { nextCursor: last.id } : {}),
        };
    }

    /** `GET /finance/flats/:id`: totals, owner contact and open charges. */
    async detail(id: string, asOfText?: string): Promise<FinanceFlatDetailDto> {
        const asOf = asOfText ? parseDateOnly(asOfText) : cairoToday();
        const flat = await this.db.flat.findUnique({
            where: { id },
            select: FLAT_SELECT,
        });
        if (!flat) throw new NotFoundException('finance.error.flatNotFound');

        const [summaries, ownership] = await Promise.all([
            summariseFlats(this.db, [id], asOf),
            this.db.flatOwnership.findFirst({
                where: { flatId: id, toDate: null },
                orderBy: { fromDate: 'desc' },
                select: {
                    fromDate: true,
                    user: { select: { id: true, name: true, phone: true } },
                },
            }),
        ]);
        const summary = summaries.get(id);
        if (!summary) throw new NotFoundException('finance.error.flatNotFound');

        const chargeRows = summary.openCharges.length
            ? await this.db.charge.findMany({
                  where: { id: { in: summary.openCharges.map(c => c.id) } },
                  select: {
                      id: true,
                      kind: true,
                      description: true,
                      descriptionAr: true,
                      accrualPeriod: true,
                  },
              })
            : [];
        const chargeById = new Map(chargeRows.map(c => [c.id, c]));

        return {
            ...flat,
            asOf: dateOnlyString(asOf),
            ...totals(summary),
            openAmount: toMoneyNumber(summary.openAmount),
            owner: ownership
                ? {
                      userId: ownership.user.id,
                      name: ownership.user.name,
                      phone: ownership.user.phone,
                      since: dateOnlyString(ownership.fromDate),
                  }
                : null,
            openCharges: summary.openCharges.map(c => {
                const row = chargeById.get(c.id);
                return {
                    id: c.id,
                    kind: row?.kind ?? ChargeKind.OTHER,
                    description: row?.description ?? '',
                    descriptionAr: row?.descriptionAr ?? '',
                    accrualPeriod: row?.accrualPeriod ?? '',
                    dueDate: dateOnlyString(c.dueDate),
                    amount: toMoneyNumber(c.amount),
                    openAmount: toMoneyNumber(c.openAmount),
                };
            }),
        };
    }

    /** `GET /finance/flats/:id/ownership`: every period, newest first. */
    async ownership(id: string): Promise<FinanceOwnershipListDto> {
        const flat = await this.db.flat.findUnique({
            where: { id },
            select: { id: true },
        });
        if (!flat) throw new NotFoundException('finance.error.flatNotFound');

        const rows = await this.db.flatOwnership.findMany({
            where: { flatId: id },
            orderBy: [
                { fromDate: 'desc' },
                { createdAt: 'desc' },
                { id: 'desc' },
            ],
            select: {
                id: true,
                fromDate: true,
                toDate: true,
                closedReason: true,
                user: { select: { name: true, deletedAt: true } },
            },
        });
        return {
            items: rows.map(r => {
                const deleted = r.user.deletedAt !== null;
                return {
                    id: r.id,
                    ownerName: deleted ? null : r.user.name,
                    ownerDeleted: deleted,
                    fromDate: dateOnlyString(r.fromDate),
                    beforeGoLive:
                        r.fromDate.getTime() ===
                        OWNERSHIP_SENTINEL_DATE.getTime(),
                    toDate: r.toDate ? dateOnlyString(r.toDate) : null,
                    closedReason: r.closedReason,
                };
            }),
        };
    }

    /** Current owner name per flat (open ownership period). */
    private async currentOwners(
        flatIds: string[]
    ): Promise<Map<string, { name: string }>> {
        if (flatIds.length === 0) return new Map();
        const rows = await this.db.flatOwnership.findMany({
            where: { flatId: { in: flatIds }, toDate: null },
            select: { flatId: true, user: { select: { name: true } } },
        });
        return new Map(rows.map(r => [r.flatId, { name: r.user.name }]));
    }
}

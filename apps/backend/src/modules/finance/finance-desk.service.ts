import { BadRequestException, Injectable } from '@nestjs/common';
import { PeriodStatus, Prisma } from '@prisma/client';

import {
    addDays,
    cairoDayStart,
    cairoPeriod,
    parseDateOnly,
} from 'src/common/finance/cairo-date';
import { DatabaseService } from 'src/common/database/services/database.service';
import { cursorArgs, toCursorPage } from 'src/common/helper/pagination';
import { FINANCE_AUDIT_ACTIONS } from 'src/modules/audit/audit.actions';

import {
    FinanceAuditQueryDto,
    FinancePeriodsQueryDto,
} from './dtos/request/finance-query.dto';
import {
    FinanceAuditPageDto,
    FinancePeriodListDto,
    FinanceSettingListDto,
} from './dtos/response/finance.response.dto';

/** Longest month range `GET /finance/periods` returns. */
export const MAX_PERIOD_SPAN = 60;

/** `YYYY-MM` shifted by `months`. */
export function shiftPeriod(period: string, months: number): string {
    const index = periodIndex(period) + months;
    const year = Math.floor(index / 12);
    const month = (index % 12) + 1;
    return `${String(year).padStart(4, '0')}-${String(month).padStart(2, '0')}`;
}

function periodIndex(period: string): number {
    const y = Number(period.slice(0, 4));
    const m = Number(period.slice(5, 7));
    return y * 12 + (m - 1);
}

function monthsInRange(from: string, to: string): string[] {
    const out: string[] = [];
    for (let p = to; p >= from; p = shiftPeriod(p, -1)) out.push(p);
    return out;
}

/** Finance desk reads: the audit trail, period status and settings (plan 7.5). */
@Injectable()
export class FinanceDeskService {
    constructor(private readonly db: DatabaseService) {}

    /**
     * `GET /finance/audit`: finance actions only, newest first. The actor
     * carries name and role, never email.
     */
    async audit(query: FinanceAuditQueryDto): Promise<FinanceAuditPageDto> {
        const limit = query.limit ?? 20;
        const createdAt: Prisma.DateTimeFilter = {};
        if (query.from)
            createdAt.gte = cairoDayStart(parseDateOnly(query.from));
        if (query.to)
            createdAt.lt = cairoDayStart(addDays(parseDateOnly(query.to), 1));
        const where: Prisma.AuditLogWhereInput = {
            action: query.action
                ? query.action
                : { in: [...FINANCE_AUDIT_ACTIONS] as string[] },
            ...(query.entity ? { entity: query.entity } : {}),
            ...(query.entityId ? { entityId: query.entityId } : {}),
            ...(query.actorId ? { userId: query.actorId } : {}),
            ...(query.from || query.to ? { createdAt } : {}),
        };
        const rows = await this.db.auditLog.findMany({
            where,
            take: limit + 1,
            ...cursorArgs(query.cursor),
            orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
            select: {
                id: true,
                action: true,
                entity: true,
                entityId: true,
                meta: true,
                createdAt: true,
                user: { select: { id: true, name: true, role: true } },
            },
        });
        const { items, nextCursor } = toCursorPage(rows, limit);
        return {
            items: items.map(({ user, meta, ...row }) => ({
                ...row,
                meta:
                    meta && typeof meta === 'object' && !Array.isArray(meta)
                        ? (meta as Record<string, unknown>)
                        : null,
                actor: user,
            })),
            ...(nextCursor ? { nextCursor } : {}),
        };
    }

    /**
     * `GET /finance/periods`: one entry per month in `[from, to]`, newest
     * first (default: the 12 months ending with the current Cairo month). A
     * month without a row is OPEN; reads never create rows.
     */
    async periods(
        query: FinancePeriodsQueryDto
    ): Promise<FinancePeriodListDto> {
        const to = query.to ?? cairoPeriod(new Date());
        const from = query.from ?? shiftPeriod(to, -11);
        const span = periodIndex(to) - periodIndex(from) + 1;
        if (span < 1 || span > MAX_PERIOD_SPAN)
            throw new BadRequestException('finance.error.invalidPeriodRange');

        const rows = await this.db.fiscalPeriod.findMany({
            where: { period: { gte: from, lte: to } },
            select: {
                period: true,
                status: true,
                closedAt: true,
                reopenedAt: true,
                reopenReason: true,
                closedBy: { select: { id: true, name: true } },
                reopenedBy: { select: { id: true, name: true } },
            },
        });
        const byPeriod = new Map(rows.map(r => [r.period, r]));
        return {
            items: monthsInRange(from, to).map(period => {
                const row = byPeriod.get(period);
                return row
                    ? { ...row }
                    : {
                          period,
                          status: PeriodStatus.OPEN,
                          closedAt: null,
                          closedBy: null,
                          reopenedAt: null,
                          reopenedBy: null,
                          reopenReason: null,
                      };
            }),
        };
    }

    /** `GET /finance/settings`: every key with its JSON value. */
    async settings(): Promise<FinanceSettingListDto> {
        const rows = await this.db.financeSetting.findMany({
            orderBy: { key: 'asc' },
            select: {
                key: true,
                value: true,
                updatedAt: true,
                updatedBy: { select: { id: true, name: true } },
            },
        });
        return { items: rows };
    }
}

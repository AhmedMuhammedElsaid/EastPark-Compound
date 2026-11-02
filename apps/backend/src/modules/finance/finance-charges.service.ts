import {
    ConflictException,
    Injectable,
    NotFoundException,
} from '@nestjs/common';
import { ChargeKind, PostingStatus } from '@prisma/client';

import {
    cairoPeriod,
    cairoToday,
    parseDateOnly,
    periodOf,
} from 'src/common/finance/cairo-date';
import { DatabaseService } from 'src/common/database/services/database.service';
import { IAuthUser } from 'src/common/request/interfaces/request.interface';

import { FinanceChargeCreateDto } from './dtos/request/finance-charge.dto';
import { FinanceChargeDto } from './dtos/response/finance.response.dto';
import { CHARGE_SELECT, toChargeDto } from './finance.mapper';
import { FinanceAuditService } from './kernel/finance-audit.service';
import { moneyString, parseFinanceAmount } from './kernel/finance-money';
import { POSTING_TX_OPTIONS } from './kernel/finance-tx';
import { summariseFlat } from './kernel/ledger';
import { lockCharges, lockFlat, lockPeriods } from './kernel/locks';
import { assertCanVoid } from './kernel/void-policy';

/**
 * Manual charges (plan 7.2). Each posting is one transaction in the fixed
 * lock order (period FOR SHARE, flat FOR UPDATE, charge FOR UPDATE) and
 * writes its finance audit row inside it.
 */
@Injectable()
export class FinanceChargesService {
    constructor(
        private readonly db: DatabaseService,
        private readonly audit: FinanceAuditService
    ) {}

    async create(
        dto: FinanceChargeCreateDto,
        actor: IAuthUser
    ): Promise<FinanceChargeDto> {
        const amount = parseFinanceAmount(dto.amount);
        const dueDate = parseDateOnly(dto.dueDate);
        const accrualPeriod = dto.accrualPeriod ?? periodOf(dueDate);
        const kind = dto.kind;

        const row = await this.db.$transaction(async tx => {
            await lockPeriods(tx, [accrualPeriod]);
            const flat = await lockFlat(tx, dto.flatId);
            if (!flat.isActive)
                throw new ConflictException('finance.error.flatInactive');

            if (dto.replacesId) {
                const original = await tx.charge.findUnique({
                    where: { id: dto.replacesId },
                    select: { flatId: true, status: true },
                });
                if (!original || original.flatId !== flat.id)
                    throw new NotFoundException('finance.error.chargeNotFound');
                if (original.status !== PostingStatus.VOID)
                    throw new ConflictException(
                        'finance.error.replacesNotVoid'
                    );
            }

            const created = await tx.charge.create({
                data: {
                    flatId: flat.id,
                    kind,
                    amount,
                    description: dto.description,
                    descriptionAr: dto.descriptionAr,
                    accrualPeriod,
                    dueDate,
                    fundContribution: kind === ChargeKind.MAINTENANCE_DEPOSIT,
                    replacesId: dto.replacesId ?? null,
                    createdById: actor.userId,
                },
                select: CHARGE_SELECT,
            });

            await this.audit.record(
                tx,
                actor,
                'CHARGE_CREATED',
                'Charge',
                created.id,
                {
                    label: `${flat.label} ${kind} ${moneyString(amount)}`,
                    flatId: flat.id,
                    flatLabel: flat.label,
                    kind,
                    amount: moneyString(amount),
                    accrualPeriod,
                    dueDate: dto.dueDate,
                    replacesId: dto.replacesId ?? null,
                }
            );
            return created;
        }, POSTING_TX_OPTIONS);

        return toChargeDto(row);
    }

    /**
     * Void (plan 3.1, 3.6): reason required, refused while the charge has a
     * live allocation (`hasAllocations`), in a closed period (`periodClosed`:
     * the charge's accrual month and the month of the void itself), or by an
     * accountant other than the poster or on a later Cairo day
     * (`voidNotAllowed`). The audit row carries the flat balance before and after.
     */
    async void(
        id: string,
        reason: string,
        actor: IAuthUser
    ): Promise<FinanceChargeDto> {
        const existing = await this.db.charge.findUnique({
            where: { id },
            select: { flatId: true, accrualPeriod: true },
        });
        if (!existing)
            throw new NotFoundException('finance.error.chargeNotFound');

        const now = new Date();
        const today = cairoToday(now);
        const row = await this.db.$transaction(async tx => {
            await lockPeriods(tx, [existing.accrualPeriod, cairoPeriod(now)]);
            const flat = await lockFlat(tx, existing.flatId);
            await lockCharges(tx, [id]);

            const charge = await tx.charge.findUnique({
                where: { id },
                select: {
                    status: true,
                    kind: true,
                    amount: true,
                    createdById: true,
                    createdAt: true,
                },
            });
            if (!charge)
                throw new NotFoundException('finance.error.chargeNotFound');
            if (charge.status === PostingStatus.VOID)
                throw new ConflictException('finance.error.alreadyVoid');
            assertCanVoid(actor, charge, now);

            const liveAllocations = await tx.paymentAllocation.count({
                where: { chargeId: id, voidedAt: null },
            });
            if (liveAllocations > 0)
                throw new ConflictException('finance.error.hasAllocations');

            const before = await summariseFlat(tx, flat.id, today);
            const updated = await tx.charge.update({
                where: { id },
                data: {
                    status: PostingStatus.VOID,
                    voidedAt: now,
                    voidedById: actor.userId,
                    voidReason: reason,
                },
                select: CHARGE_SELECT,
            });
            const after = await summariseFlat(tx, flat.id, today);

            await this.audit.record(tx, actor, 'CHARGE_VOIDED', 'Charge', id, {
                label: `${flat.label} ${charge.kind} ${moneyString(charge.amount)}`,
                flatId: flat.id,
                flatLabel: flat.label,
                amount: moneyString(charge.amount),
                reason,
                balanceBefore: moneyString(before.balance),
                balanceAfter: moneyString(after.balance),
            });
            return updated;
        }, POSTING_TX_OPTIONS);

        return toChargeDto(row);
    }
}

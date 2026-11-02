import {
    BadRequestException,
    ConflictException,
    Injectable,
    Logger,
    NotFoundException,
} from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import {
    ChequeState,
    FinancePaymentMethod,
    PostingStatus,
    Prisma,
} from '@prisma/client';

import {
    cairoDayStart,
    cairoPeriod,
    cairoToday,
    dateOnlyString,
    parseDateOnly,
    periodOf,
} from 'src/common/finance/cairo-date';
import { DatabaseService } from 'src/common/database/services/database.service';
import { ENUM_FILE_STORE } from 'src/common/file/enums/files.enum';
import {
    FINANCE_STAGING_MAX_AGE_MS,
    isOwnStagingPath,
    PrivateFileService,
} from 'src/common/file/services/private-file.service';
import { toMoneyNumber } from 'src/common/helper/money';
import { cursorArgs, toCursorPage } from 'src/common/helper/pagination';
import { IAuthUser } from 'src/common/request/interfaces/request.interface';

import {
    FinanceApplyCreditDto,
    FinanceChequeDateDto,
    FinancePaymentCreateDto,
    FinancePaymentsQueryDto,
    PayFor,
} from './dtos/request/finance-payment.dto';
import {
    FinanceApplyCreditResultDto,
    FinanceFlatTotalsDto,
    FinancePaymentDetailDto,
    FinancePaymentPageDto,
    FinancePaymentResultDto,
} from './dtos/response/finance.response.dto';
import {
    ALLOCATION_SELECT,
    PAYMENT_SELECT,
    PaymentRow,
    toAllocationDto,
    toPaymentDetailDto,
    toPaymentDto,
} from './finance-payment.mapper';
import {
    AllocationLine,
    lockOpenCharges,
    planAutoAllocation,
    planExplicitAllocation,
    RequestedAllocation,
    sumLines,
} from './kernel/allocation';
import { FinanceAuditService } from './kernel/finance-audit.service';
import { moneyString, parseFinanceAmount } from './kernel/finance-money';
import { readGoLiveAt } from './kernel/finance-settings';
import { FinanceTx, POSTING_TX_OPTIONS } from './kernel/finance-tx';
import {
    insertAllocations,
    NewAllocation,
    reserveFundNumbers,
} from './kernel/fund-deposits';
import { requestHashOf, runIdempotent } from './kernel/idempotency';
import { FlatFinanceSummary, summariseFlat } from './kernel/ledger';
import { livePaymentWhere } from './kernel/live-predicates';
import { lockCharges, lockFlat, lockPeriods } from './kernel/locks';
import { nextReceiptNumber } from './kernel/receipt-counter';
import { assertCanVoid } from './kernel/void-policy';

/**
 * A staged upload older than this cannot be attached any more: the daily
 * sweep deletes unattached staging objects after 24 h, so the 4 h margin
 * keeps a payment from pointing at an object the sweep is about to remove.
 */
export const ATTACH_MAX_AGE_MS = 20 * 60 * 60 * 1000;

/** `allocations[].voidReason` written by a cheque bounce. */
export const BOUNCE_VOID_REASON = 'Cheque bounced';

interface PaymentInput {
    flatId: string;
    amount: Prisma.Decimal;
    method: FinancePaymentMethod;
    reference: string | null;
    receivedAt: Date;
    payerName: string | null;
    note: string | null;
    attachmentPath: string | null;
    allocations: RequestedAllocation[] | null;
    payFor: PayFor;
    replacesId: string | null;
}

function totals(summary: FlatFinanceSummary): FinanceFlatTotalsDto {
    return {
        balance: toMoneyNumber(summary.balance),
        credit: toMoneyNumber(summary.credit),
        availableCredit: toMoneyNumber(summary.availableCredit),
        overdueAmount: toMoneyNumber(summary.overdueAmount),
        oldestDueDays: summary.oldestDueDays,
    };
}

function parseRequested(
    allocations: readonly { chargeId: string; amount: unknown }[] | undefined
): RequestedAllocation[] | null {
    if (!allocations) return null;
    return allocations.map(a => ({
        chargeId: a.chargeId,
        amount: parseFinanceAmount(a.amount),
    }));
}

/** Upload time encoded in a staging file name (`<ms>-<uuid>.<ext>`). */
function stagedAt(path: string): number | null {
    const name = path.split('/').pop() ?? '';
    const ms = Number(name.split('-')[0]);
    return Number.isSafeInteger(ms) && ms > 0 ? ms : null;
}

/**
 * Payments (plan 3.3, 3.4, 3.8, 7.2). Every posting is one transaction in the
 * fixed lock order (period FOR SHARE, flat FOR UPDATE, charges FOR UPDATE,
 * receipt counter, inserts) and writes its finance audit row inside it.
 * Balances and credit come from the shared live predicates (`summariseFlat`).
 */
@Injectable()
export class FinancePaymentsService {
    private readonly logger = new Logger(FinancePaymentsService.name);

    constructor(
        private readonly db: DatabaseService,
        private readonly audit: FinanceAuditService,
        private readonly files: PrivateFileService
    ) {}

    // ── record ──────────────────────────────────────────────────────────

    /**
     * `POST /finance/payments` (plan 3.3 idempotency): the key is stored in
     * the unique `Payment.requestKey`; a retry returns the original payment,
     * another body under the same key is `idempotencyConflict`, and a
     * concurrent duplicate loses the unique insert (P2002) and returns the
     * winner's row. `force` is not part of the request hash, so re-sending a
     * request with `force: true` after a `duplicateReference` warning is fine.
     */
    async create(
        dto: FinancePaymentCreateDto,
        requestKey: string,
        actor: IAuthUser
    ): Promise<FinancePaymentResultDto> {
        const input = this.normalise(dto, actor);
        const requestHash = requestHashOf(actor.userId, input);
        const outcome = await runIdempotent<PaymentRow>({
            requestHash,
            find: () =>
                this.db.payment.findUnique({
                    where: { requestKey },
                    select: PAYMENT_SELECT,
                }),
            create: () =>
                this.post(
                    input,
                    dto.force === true,
                    requestKey,
                    requestHash,
                    actor
                ),
        });
        if (!outcome.replayed) await this.promoteAttachment(outcome.result);
        return this.withTotals(outcome.result);
    }

    private normalise(
        dto: FinancePaymentCreateDto,
        actor: IAuthUser
    ): PaymentInput {
        const attachmentPath = dto.attachmentPath ?? null;
        if (
            attachmentPath !== null &&
            !isOwnStagingPath(attachmentPath, actor.userId)
        )
            throw new BadRequestException('finance.error.attachmentInvalid');
        return {
            flatId: dto.flatId,
            amount: parseFinanceAmount(dto.amount),
            method: dto.method,
            reference: dto.reference ?? null,
            receivedAt: parseDateOnly(dto.receivedAt),
            payerName: dto.payerName ?? null,
            note: dto.note ?? null,
            attachmentPath,
            allocations: parseRequested(dto.allocations),
            payFor: dto.payFor ?? 'AUTO',
            replacesId: dto.replacesId ?? null,
        };
    }

    /**
     * Time-dependent checks run only for a NEW posting (never refuse a replay):
     * `receivedAt` lies in [Cairo month of `finance.goLiveAt`, today] (earlier
     * money belongs to the opening import), and a staged attachment is fresh.
     */
    private async assertPostable(input: PaymentInput, now: Date) {
        const today = cairoToday(now);
        if (input.receivedAt.getTime() > today.getTime())
            throw new BadRequestException('finance.error.futureDate');
        const goLiveAt = await readGoLiveAt(this.db);
        if (goLiveAt && periodOf(input.receivedAt) < cairoPeriod(goLiveAt))
            throw new BadRequestException('finance.error.receivedOutOfRange');
        if (input.attachmentPath) {
            const at = stagedAt(input.attachmentPath);
            if (at === null || now.getTime() - at > ATTACH_MAX_AGE_MS)
                throw new BadRequestException(
                    'finance.error.attachmentExpired'
                );
        }
    }

    private async post(
        input: PaymentInput,
        force: boolean,
        requestKey: string,
        requestHash: string,
        actor: IAuthUser
    ): Promise<PaymentRow> {
        const now = new Date();
        await this.assertPostable(input, now);
        const today = cairoToday(now);

        return this.db.$transaction(async tx => {
            await lockPeriods(tx, [periodOf(input.receivedAt)]);
            const flat = await lockFlat(tx, input.flatId);
            if (!flat.isActive)
                throw new ConflictException('finance.error.flatInactive');
            if (input.replacesId)
                await this.assertReplaceable(tx, input.replacesId, flat.id);

            const charges = await lockOpenCharges(
                tx,
                flat.id,
                input.allocations?.map(a => a.chargeId)
            );
            const lines: AllocationLine[] = input.allocations
                ? planExplicitAllocation(
                      charges,
                      input.allocations,
                      input.amount,
                      'finance.error.allocationExceedsPayment'
                  )
                : planAutoAllocation(charges, input.amount, input.payFor);

            if (input.attachmentPath) {
                const used = await tx.payment.count({
                    where: { attachmentPath: input.attachmentPath },
                });
                if (used > 0)
                    throw new ConflictException(
                        'finance.error.attachmentInUse'
                    );
            }
            if (input.reference && !force) {
                const duplicate = await tx.payment.findFirst({
                    where: {
                        ...livePaymentWhere(today),
                        method: input.method,
                        reference: {
                            equals: input.reference,
                            mode: 'insensitive',
                        },
                        isOpening: false,
                    },
                    select: { id: true },
                });
                if (duplicate)
                    throw new ConflictException(
                        'finance.error.duplicateReference'
                    );
            }

            // step 3: counters last (R for the receipt, F for deposit entries)
            const receiptNo = await nextReceiptNumber(
                tx,
                'R',
                input.receivedAt
            );
            const fundNumbers = await reserveFundNumbers(
                tx,
                lines,
                input.receivedAt
            );

            const payment = await tx.payment.create({
                data: {
                    receiptNo,
                    amount: input.amount,
                    method: input.method,
                    requestKey,
                    requestHash,
                    reference: input.reference,
                    chequeState:
                        input.method === FinancePaymentMethod.CHEQUE
                            ? ChequeState.PENDING_CLEARANCE
                            : ChequeState.NOT_APPLICABLE,
                    receivedAt: input.receivedAt,
                    payerName: input.payerName,
                    note: input.note,
                    attachmentPath: input.attachmentPath,
                    flatId: flat.id,
                    replacesId: input.replacesId,
                    createdById: actor.userId,
                },
                select: { id: true },
            });
            await insertAllocations(
                tx,
                lines.map((l): NewAllocation => ({
                    ...l,
                    paymentId: payment.id,
                    receiptNo,
                })),
                input.receivedAt,
                fundNumbers,
                flat.label,
                actor.userId
            );

            const allocated = sumLines(lines);
            await this.audit.record(
                tx,
                actor,
                'PAYMENT_RECORDED',
                'Payment',
                payment.id,
                {
                    label: `${flat.label} ${receiptNo} ${moneyString(input.amount)}`,
                    flatId: flat.id,
                    flatLabel: flat.label,
                    receiptNo,
                    amount: moneyString(input.amount),
                    method: input.method,
                    receivedAt: dateOnlyString(input.receivedAt),
                    allocations: lines.length,
                    allocated: moneyString(allocated),
                    unallocated: moneyString(input.amount.sub(allocated)),
                    mode: input.allocations ? 'EXPLICIT' : input.payFor,
                    hasReference: input.reference !== null,
                    hasAttachment: input.attachmentPath !== null,
                    forcedDuplicate: force && input.reference !== null,
                    replacesId: input.replacesId,
                }
            );
            return tx.payment.findUniqueOrThrow({
                where: { id: payment.id },
                select: PAYMENT_SELECT,
            });
        }, POSTING_TX_OPTIONS);
    }

    /** `replacesId` (plan 3.1): a VOID payment of the same flat, not yet replaced. */
    private async assertReplaceable(
        tx: FinanceTx,
        replacesId: string,
        flatId: string
    ): Promise<void> {
        const original = await tx.payment.findUnique({
            where: { id: replacesId },
            select: { flatId: true, status: true },
        });
        if (!original || original.flatId !== flatId)
            throw new NotFoundException('finance.error.paymentNotFound');
        if (original.status !== PostingStatus.VOID)
            throw new ConflictException('finance.error.replacesNotVoid');
        const replacements = await tx.payment.count({
            where: { replacesId, status: PostingStatus.POSTED },
        });
        if (replacements > 0)
            throw new ConflictException('finance.error.alreadyReplaced');
    }

    private async withTotals(
        row: PaymentRow
    ): Promise<FinancePaymentResultDto> {
        const asOf = cairoToday();
        const summary = await summariseFlat(this.db, row.flatId, asOf);
        return {
            ...toPaymentDetailDto(row),
            asOf: dateOnlyString(asOf),
            flatTotals: totals(summary),
        };
    }

    // ── reads ───────────────────────────────────────────────────────────

    /** `GET /finance/payments`: newest cash date first. */
    async list(query: FinancePaymentsQueryDto): Promise<FinancePaymentPageDto> {
        const limit = query.limit ?? 20;
        if (query.cursor) {
            const exists = await this.db.payment.findUnique({
                where: { id: query.cursor },
                select: { id: true },
            });
            if (!exists)
                throw new BadRequestException('finance.error.invalidCursor');
        }
        const receivedAt: Prisma.DateTimeFilter = {};
        if (query.from) receivedAt.gte = parseDateOnly(query.from);
        if (query.to) receivedAt.lte = parseDateOnly(query.to);
        const where: Prisma.PaymentWhereInput = {
            ...(query.flatId ? { flatId: query.flatId } : {}),
            ...(query.method ? { method: query.method } : {}),
            ...(query.status ? { status: query.status } : {}),
            ...(query.chequeState ? { chequeState: query.chequeState } : {}),
            ...(query.createdById ? { createdById: query.createdById } : {}),
            ...(query.from || query.to ? { receivedAt } : {}),
            ...(query.q
                ? {
                      OR: [
                          {
                              receiptNo: {
                                  contains: query.q,
                                  mode: 'insensitive',
                              },
                          },
                          {
                              reference: {
                                  contains: query.q,
                                  mode: 'insensitive',
                              },
                          },
                      ],
                  }
                : {}),
        };
        const rows = await this.db.payment.findMany({
            where,
            take: limit + 1,
            ...cursorArgs(query.cursor),
            orderBy: [
                { receivedAt: 'desc' },
                { createdAt: 'desc' },
                { id: 'desc' },
            ],
            select: PAYMENT_SELECT,
        });
        const { items, nextCursor } = toCursorPage(rows, limit);
        return {
            items: items.map(toPaymentDto),
            ...(nextCursor ? { nextCursor } : {}),
        };
    }

    /** `GET /finance/payments/:id`: payment, allocations, attachment flag. */
    async detail(id: string): Promise<FinancePaymentDetailDto> {
        const row = await this.db.payment.findUnique({
            where: { id },
            select: PAYMENT_SELECT,
        });
        if (!row) throw new NotFoundException('finance.error.paymentNotFound');
        return toPaymentDetailDto(row);
    }

    // ── void ────────────────────────────────────────────────────────────

    /**
     * Void (plan 3.1, 3.6): reason required; the payment's live allocations and
     * its DEPOSIT_IN fund entries are voided in the same transaction (the
     * charges it settled become open again). Refused in a closed period: the
     * payment's month, the month of every live allocation and of the void
     * itself (`periodClosed`); by an accountant other than the poster or on a
     * later Cairo day (`voidNotAllowed`); for opening-import rows
     * (`voidImportInstead`). The audit row carries the balance before/after.
     */
    async void(
        id: string,
        reason: string,
        actor: IAuthUser
    ): Promise<FinancePaymentDetailDto> {
        const existing = await this.db.payment.findUnique({
            where: { id },
            select: {
                flatId: true,
                receivedAt: true,
                allocations: {
                    where: { voidedAt: null },
                    select: { allocatedAt: true },
                },
            },
        });
        if (!existing)
            throw new NotFoundException('finance.error.paymentNotFound');

        const now = new Date();
        const today = cairoToday(now);
        const periods = new Set([
            periodOf(existing.receivedAt),
            cairoPeriod(now),
            ...existing.allocations.map(a => periodOf(a.allocatedAt)),
        ]);

        const row = await this.db.$transaction(async tx => {
            await lockPeriods(tx, [...periods]);
            const flat = await lockFlat(tx, existing.flatId);
            const payment = await tx.payment.findUnique({
                where: { id },
                select: {
                    status: true,
                    amount: true,
                    receiptNo: true,
                    isOpening: true,
                    createdById: true,
                    createdAt: true,
                    allocations: {
                        where: { voidedAt: null },
                        select: { chargeId: true, allocatedAt: true },
                    },
                },
            });
            if (!payment)
                throw new NotFoundException('finance.error.paymentNotFound');
            if (payment.status === PostingStatus.VOID)
                throw new ConflictException('finance.error.alreadyVoid');
            if (payment.isOpening)
                throw new ConflictException('finance.error.voidImportInstead');
            assertCanVoid(actor, payment, now);

            // An allocation added between the read above and the flat lock
            // (apply-credit) can name a month not locked yet. Taking that
            // FOR SHARE lock now is deadlock-free: a period close holds one
            // period row and waits for nothing else (plan 3.4).
            const missing = payment.allocations
                .map(a => periodOf(a.allocatedAt))
                .filter(p => !periods.has(p));
            if (missing.length > 0) await lockPeriods(tx, missing);
            await lockCharges(
                tx,
                payment.allocations.map(a => a.chargeId)
            );

            const before = await summariseFlat(tx, flat.id, today);
            await tx.payment.update({
                where: { id },
                data: {
                    status: PostingStatus.VOID,
                    voidedAt: now,
                    voidedById: actor.userId,
                    voidReason: reason,
                },
                select: { id: true },
            });
            const allocations = await tx.paymentAllocation.updateMany({
                where: { paymentId: id, voidedAt: null },
                data: {
                    voidedAt: now,
                    voidedById: actor.userId,
                    voidReason: reason,
                },
            });
            const fundEntries = await tx.fundEntry.updateMany({
                where: { paymentId: id, status: PostingStatus.POSTED },
                data: {
                    status: PostingStatus.VOID,
                    voidedAt: now,
                    voidedById: actor.userId,
                    voidReason: reason,
                },
            });
            const after = await summariseFlat(tx, flat.id, today);

            await this.audit.record(
                tx,
                actor,
                'PAYMENT_VOIDED',
                'Payment',
                id,
                {
                    label: `${flat.label} ${payment.receiptNo} ${moneyString(payment.amount)}`,
                    flatId: flat.id,
                    flatLabel: flat.label,
                    receiptNo: payment.receiptNo,
                    amount: moneyString(payment.amount),
                    reason,
                    allocationsVoided: allocations.count,
                    fundEntriesVoided: fundEntries.count,
                    balanceBefore: moneyString(before.balance),
                    balanceAfter: moneyString(after.balance),
                }
            );
            return tx.payment.findUniqueOrThrow({
                where: { id },
                select: PAYMENT_SELECT,
            });
        }, POSTING_TX_OPTIONS);

        return toPaymentDetailDto(row);
    }

    // ── cheques ─────────────────────────────────────────────────────────

    /** `POST /finance/payments/:id/cheque-cleared` (plan 3.8). */
    chequeCleared(
        id: string,
        dto: FinanceChequeDateDto,
        actor: IAuthUser
    ): Promise<FinancePaymentDetailDto> {
        return this.changeChequeState(id, dto, actor, ChequeState.CLEARED);
    }

    /**
     * `POST /finance/payments/:id/cheque-bounced` (plan 3.8, 2.1.1 H1): the
     * payment stays POSTED with `bouncedAt = date`, so it is live for every
     * date before the bounce and not live from it on; its live allocations and
     * DEPOSIT_IN entries are voided AS OF the bounce date (`voidedAt` = start
     * of that Cairo day). Only the bounce date's month is locked: a cheque
     * received in a closed month can bounce in the open one without changing
     * the closed month's figures.
     */
    chequeBounced(
        id: string,
        dto: FinanceChequeDateDto,
        actor: IAuthUser
    ): Promise<FinancePaymentDetailDto> {
        return this.changeChequeState(id, dto, actor, ChequeState.BOUNCED);
    }

    private async changeChequeState(
        id: string,
        dto: FinanceChequeDateDto,
        actor: IAuthUser,
        to: 'CLEARED' | 'BOUNCED'
    ): Promise<FinancePaymentDetailDto> {
        const now = new Date();
        const today = cairoToday(now);
        const date = dto.date ? parseDateOnly(dto.date) : today;
        if (date.getTime() > today.getTime())
            throw new BadRequestException('finance.error.futureDate');
        const existing = await this.db.payment.findUnique({
            where: { id },
            select: { flatId: true },
        });
        if (!existing)
            throw new NotFoundException('finance.error.paymentNotFound');

        const row = await this.db.$transaction(async tx => {
            await lockPeriods(tx, [periodOf(date)]);
            const flat = await lockFlat(tx, existing.flatId);
            const payment = await tx.payment.findUnique({
                where: { id },
                select: {
                    method: true,
                    chequeState: true,
                    status: true,
                    receivedAt: true,
                    receiptNo: true,
                    amount: true,
                    allocations: {
                        where: { voidedAt: null },
                        select: { chargeId: true },
                    },
                },
            });
            if (!payment)
                throw new NotFoundException('finance.error.paymentNotFound');
            if (payment.method !== FinancePaymentMethod.CHEQUE)
                throw new ConflictException('finance.error.notACheque');
            if (payment.status === PostingStatus.VOID)
                throw new ConflictException('finance.error.alreadyVoid');
            if (payment.chequeState !== ChequeState.PENDING_CLEARANCE)
                throw new ConflictException('finance.error.alreadyFinal');
            if (date.getTime() < payment.receivedAt.getTime())
                throw new BadRequestException(
                    'finance.error.dateBeforeReceived'
                );

            let allocationsVoided = 0;
            let fundEntriesVoided = 0;
            let before: FlatFinanceSummary | null = null;
            if (to === ChequeState.CLEARED) {
                await tx.payment.update({
                    where: { id },
                    data: { chequeState: ChequeState.CLEARED, clearedAt: date },
                    select: { id: true },
                });
            } else {
                await lockCharges(
                    tx,
                    payment.allocations.map(a => a.chargeId)
                );
                before = await summariseFlat(tx, flat.id, today);
                const effectiveAt = cairoDayStart(date);
                await tx.payment.update({
                    where: { id },
                    data: { chequeState: ChequeState.BOUNCED, bouncedAt: date },
                    select: { id: true },
                });
                allocationsVoided = (
                    await tx.paymentAllocation.updateMany({
                        where: { paymentId: id, voidedAt: null },
                        data: {
                            voidedAt: effectiveAt,
                            voidedById: actor.userId,
                            voidReason: BOUNCE_VOID_REASON,
                        },
                    })
                ).count;
                fundEntriesVoided = (
                    await tx.fundEntry.updateMany({
                        where: { paymentId: id, status: PostingStatus.POSTED },
                        data: {
                            status: PostingStatus.VOID,
                            voidedAt: effectiveAt,
                            voidedById: actor.userId,
                            voidReason: BOUNCE_VOID_REASON,
                        },
                    })
                ).count;
            }
            const after = before
                ? await summariseFlat(tx, flat.id, today)
                : null;

            await this.audit.record(
                tx,
                actor,
                'CHEQUE_STATE_CHANGED',
                'Payment',
                id,
                {
                    label: `${flat.label} ${payment.receiptNo} ${to}`,
                    flatId: flat.id,
                    flatLabel: flat.label,
                    receiptNo: payment.receiptNo,
                    amount: moneyString(payment.amount),
                    from: ChequeState.PENDING_CLEARANCE,
                    to,
                    date: dateOnlyString(date),
                    receivedAt: dateOnlyString(payment.receivedAt),
                    allocationsVoided,
                    fundEntriesVoided,
                    balanceBefore: before ? moneyString(before.balance) : null,
                    balanceAfter: after ? moneyString(after.balance) : null,
                }
            );
            return tx.payment.findUniqueOrThrow({
                where: { id },
                select: PAYMENT_SELECT,
            });
        }, POSTING_TX_OPTIONS);

        return toPaymentDetailDto(row);
    }

    // ── credit ──────────────────────────────────────────────────────────

    /**
     * `POST /finance/flats/:id/apply-credit` (plan 3.5): turns the flat's
     * credit into allocations dated today (an open period, never a closed
     * month), capped at `availableCredit`. Money comes from the flat's live
     * payments with money left, oldest first. One payment can settle a charge
     * only once (`@@unique([paymentId, chargeId])`), so a charge the payment
     * already part-settled is funded from another payment; in explicit mode,
     * if no other payment can cover it, the request fails with
     * `creditSourceConflict`, in auto mode that charge is skipped.
     */
    async applyCredit(
        flatId: string,
        dto: FinanceApplyCreditDto,
        actor: IAuthUser
    ): Promise<FinanceApplyCreditResultDto> {
        const requested = parseRequested(dto.allocations);
        const cap =
            dto.amount !== undefined ? parseFinanceAmount(dto.amount) : null;
        const payFor = dto.payFor ?? 'AUTO';
        const now = new Date();
        const today = cairoToday(now);

        const result = await this.db.$transaction(async tx => {
            await lockPeriods(tx, [periodOf(today)]);
            const flat = await lockFlat(tx, flatId);
            const charges = await lockOpenCharges(
                tx,
                flat.id,
                requested?.map(a => a.chargeId)
            );

            const sources = (
                await tx.payment.findMany({
                    where: { flatId: flat.id, ...livePaymentWhere(today) },
                    orderBy: [
                        { receivedAt: 'asc' },
                        { createdAt: 'asc' },
                        { id: 'asc' },
                    ],
                    select: {
                        id: true,
                        receiptNo: true,
                        amount: true,
                        allocations: {
                            select: {
                                chargeId: true,
                                amount: true,
                                voidedAt: true,
                            },
                        },
                    },
                })
            )
                .map(p => ({
                    id: p.id,
                    receiptNo: p.receiptNo,
                    settled: new Set(p.allocations.map(a => a.chargeId)),
                    left: p.allocations
                        .filter(a => a.voidedAt === null)
                        .reduce((s, a) => s.sub(a.amount), p.amount),
                }))
                .filter(s => s.left.gt(0));

            const before = await summariseFlat(tx, flat.id, today);
            const unallocated = sumLines(
                sources.map(s => ({ amount: s.left }))
            );
            const available = Prisma.Decimal.min(
                unallocated,
                before.availableCredit
            );
            if (available.lte(0))
                throw new ConflictException('finance.error.insufficientCredit');

            const targets = requested
                ? planExplicitAllocation(
                      charges,
                      requested,
                      available,
                      'finance.error.insufficientCredit'
                  )
                : planAutoAllocation(
                      charges,
                      cap ? Prisma.Decimal.min(cap, available) : available,
                      payFor
                  );

            const lines: NewAllocation[] = [];
            for (const target of targets) {
                let need = target.amount;
                for (const source of sources) {
                    if (need.lte(0)) break;
                    if (source.left.lte(0)) continue;
                    if (source.settled.has(target.chargeId)) continue;
                    const take = Prisma.Decimal.min(need, source.left);
                    lines.push({
                        paymentId: source.id,
                        receiptNo: source.receiptNo,
                        chargeId: target.chargeId,
                        kind: target.kind,
                        amount: take,
                    });
                    source.left = source.left.sub(take);
                    source.settled.add(target.chargeId);
                    need = need.sub(take);
                }
                if (need.gt(0) && requested)
                    throw new ConflictException(
                        'finance.error.creditSourceConflict'
                    );
            }
            if (lines.length === 0)
                throw new ConflictException('finance.error.nothingToAllocate');

            const fundNumbers = await reserveFundNumbers(tx, lines, today);
            const ids = await insertAllocations(
                tx,
                lines,
                today,
                fundNumbers,
                flat.label,
                actor.userId
            );
            const after = await summariseFlat(tx, flat.id, today);
            const applied = sumLines(lines);

            await this.audit.record(
                tx,
                actor,
                'CREDIT_APPLIED',
                'Flat',
                flat.id,
                {
                    label: `${flat.label} credit ${moneyString(applied)}`,
                    flatId: flat.id,
                    flatLabel: flat.label,
                    applied: moneyString(applied),
                    allocations: lines.length,
                    mode: requested ? 'EXPLICIT' : payFor,
                    creditBefore: moneyString(before.credit),
                    creditAfter: moneyString(after.credit),
                    balanceBefore: moneyString(before.balance),
                    balanceAfter: moneyString(after.balance),
                }
            );
            const rows = await tx.paymentAllocation.findMany({
                where: { id: { in: ids } },
                select: ALLOCATION_SELECT,
                orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
            });
            return { flat, applied, rows, after };
        }, POSTING_TX_OPTIONS);

        return {
            flatId: result.flat.id,
            flatLabel: result.flat.label,
            applied: toMoneyNumber(result.applied),
            allocations: result.rows.map(toAllocationDto),
            asOf: dateOnlyString(today),
            flatTotals: totals(result.after),
        };
    }

    // ── attachments housekeeping ────────────────────────────────────────

    /**
     * Moves an attached slip out of `staging/` to
     * `receipts/<year>/<receiptNo>/<file>` (plan 5.2 naming): copy, point the
     * row at the copy, then delete the staged object. Every step is
     * best-effort and ordered so the row always names an existing object; a
     * failure leaves the row on its staging path, which the sweep never
     * deletes (it is referenced) and promotes again later.
     */
    async promoteAttachment(row: {
        id: string;
        receiptNo: string;
        attachmentPath: string | null;
    }): Promise<void> {
        const from = row.attachmentPath;
        if (!from?.startsWith(`${ENUM_FILE_STORE.FINANCE_STAGING}/`)) return;
        try {
            const year = row.receiptNo.split('-')[1] ?? 'unknown';
            const file = from.split('/').pop() as string;
            const to = `${ENUM_FILE_STORE.FINANCE_RECEIPTS}/${year}/${row.receiptNo}/${file}`;
            if (!(await this.files.copy(from, to))) return;
            const moved = await this.db.payment.updateMany({
                where: { id: row.id, attachmentPath: from },
                data: { attachmentPath: to },
            });
            await this.files.remove([moved.count === 1 ? from : to]);
        } catch (error) {
            this.logger.warn(
                `Attachment promotion for payment ${row.id} failed: ${(error as Error).message}`
            );
        }
    }

    /**
     * Daily sweep (plan 5.3): staged uploads older than 24 h that no payment
     * references are deleted; referenced ones (a failed promotion) are
     * promoted again. Never throws.
     */
    @Cron('30 3 * * *', {
        name: 'finance-staging-sweep',
        timeZone: 'Africa/Cairo',
    })
    async sweepStaging(): Promise<{ promoted: number; deleted: number }> {
        try {
            const stale = await this.files.listStagingBefore(
                new Date(Date.now() - FINANCE_STAGING_MAX_AGE_MS)
            );
            if (stale.length === 0) return { promoted: 0, deleted: 0 };
            const paths = stale.map(s => s.path);
            const referenced = await this.db.payment.findMany({
                where: { attachmentPath: { in: paths } },
                select: { id: true, receiptNo: true, attachmentPath: true },
            });
            for (const row of referenced) await this.promoteAttachment(row);
            const keep = new Set(referenced.map(r => r.attachmentPath));
            const orphans = paths.filter(p => !keep.has(p));
            const deleted =
                orphans.length > 0 && (await this.files.remove(orphans))
                    ? orphans.length
                    : 0;
            if (deleted > 0 || referenced.length > 0)
                this.logger.log(
                    `Finance staging sweep: ${deleted} deleted, ${referenced.length} promoted`
                );
            return { promoted: referenced.length, deleted };
        } catch (error) {
            this.logger.error(
                `Finance staging sweep failed: ${(error as Error).message}`
            );
            return { promoted: 0, deleted: 0 };
        }
    }
}

import { FinanceReader } from './finance-tx';

/** Seeded `finance_settings` keys (migration `20261102000000_finance_foundations`). */
export const FINANCE_SETTING_KEYS = {
    approvalThreshold: 'expense.approvalThreshold',
    fiscalYearStartMonth: 'fiscal.yearStartMonth',
    defaultDueDay: 'billing.defaultDueDay',
    goLiveAt: 'finance.goLiveAt',
} as const;

/** `finance.goLiveAt` (UTC ISO string set by the migration), or null when missing/invalid. */
export async function readGoLiveAt(
    client: FinanceReader
): Promise<Date | null> {
    const row = await client.financeSetting.findUnique({
        where: { key: FINANCE_SETTING_KEYS.goLiveAt },
        select: { value: true },
    });
    const at = typeof row?.value === 'string' ? new Date(row.value) : null;
    return at && !Number.isNaN(at.getTime()) ? at : null;
}

/** `fiscal.yearStartMonth` (1-12); January when unset or malformed. */
export async function readFiscalYearStartMonth(
    client: FinanceReader
): Promise<number> {
    const row = await client.financeSetting.findUnique({
        where: { key: FINANCE_SETTING_KEYS.fiscalYearStartMonth },
        select: { value: true },
    });
    const value = Number(row?.value);
    return Number.isInteger(value) && value >= 1 && value <= 12 ? value : 1;
}

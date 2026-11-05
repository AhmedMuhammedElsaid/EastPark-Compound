import { Prisma, PrismaClient } from '@prisma/client';

/** The interactive-transaction client every posting helper runs on. */
export type FinanceTx = Prisma.TransactionClient;

/** A transaction client or the root client (reads only). */
export type FinanceReader = Prisma.TransactionClient | PrismaClient;

/**
 * Transaction options for a single-flat posting. A bulk posting (billing run
 * commit, opening import) sets its own larger `{ timeout, maxWait }` (plan 3.4).
 */
export const POSTING_TX_OPTIONS = { maxWait: 10_000, timeout: 20_000 } as const;

import { Module } from '@nestjs/common';

import { DatabaseModule } from 'src/common/database/database.module';

import { FinanceChargesController } from './finance-charges.controller';
import { FinanceChargesService } from './finance-charges.service';
import { FinanceDeskController } from './finance-desk.controller';
import { FinanceDeskService } from './finance-desk.service';
import { FinanceFlatsController } from './finance-flats.controller';
import { FinanceFlatsService } from './finance-flats.service';
import { FinanceAuditService } from './kernel/finance-audit.service';

/**
 * Accounting (Phase 1a). Staff routes are `[ACCOUNTANT, ADMIN]`; the kernel
 * helpers in `kernel/` (period lock, receipt counter, idempotency, live
 * predicates, ledger figures, finance audit) are shared by every posting.
 */
@Module({
    imports: [DatabaseModule],
    controllers: [
        FinanceFlatsController,
        FinanceChargesController,
        FinanceDeskController,
    ],
    providers: [
        FinanceAuditService,
        FinanceFlatsService,
        FinanceChargesService,
        FinanceDeskService,
    ],
    exports: [FinanceAuditService],
})
export class FinanceModule {}

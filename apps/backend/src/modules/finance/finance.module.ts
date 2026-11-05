import { Module } from '@nestjs/common';

import { DatabaseModule } from 'src/common/database/database.module';
import { FileModule } from 'src/common/file/file.module';

import { FinanceAttachmentsService } from './finance-attachments.service';
import { FinanceChargesController } from './finance-charges.controller';
import { FinanceChargesService } from './finance-charges.service';
import { FinanceDeskController } from './finance-desk.controller';
import { FinanceDeskService } from './finance-desk.service';
import { FinanceFlatsController } from './finance-flats.controller';
import { FinanceFlatsService } from './finance-flats.service';
import {
    FinanceAttachmentsController,
    FinanceCreditController,
    FinancePaymentsController,
} from './finance-payments.controller';
import { FinancePaymentsService } from './finance-payments.service';
import { FinanceAuditService } from './kernel/finance-audit.service';

/**
 * Accounting (Phase 1a). Staff routes are `[ACCOUNTANT, ADMIN]`; the kernel
 * helpers in `kernel/` (period lock, receipt counter, idempotency, live
 * predicates, ledger figures, allocation, finance audit) are shared by every
 * posting. Slip/cheque files go through `PrivateFileService` (private bucket).
 */
@Module({
    imports: [DatabaseModule, FileModule],
    controllers: [
        FinanceFlatsController,
        FinanceChargesController,
        FinanceDeskController,
        FinancePaymentsController,
        FinanceCreditController,
        FinanceAttachmentsController,
    ],
    providers: [
        FinanceAuditService,
        FinanceFlatsService,
        FinanceChargesService,
        FinanceDeskService,
        FinancePaymentsService,
        FinanceAttachmentsService,
    ],
    exports: [FinanceAuditService],
})
export class FinanceModule {}

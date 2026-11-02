import {
    BadRequestException,
    Injectable,
    NotFoundException,
} from '@nestjs/common';

import { DatabaseService } from 'src/common/database/services/database.service';
import {
    FINANCE_SIGNED_URL_TTL_SEC,
    isFinanceAttachmentPath,
    PrivateFileService,
} from 'src/common/file/services/private-file.service';
import { IAuthUser } from 'src/common/request/interfaces/request.interface';

import { FinanceSignedUrlQueryDto } from './dtos/request/finance-payment.dto';
import {
    FinanceAttachmentUploadDto,
    FinanceSignedUrlDto,
} from './dtos/response/finance.response.dto';
import { FinanceAuditService } from './kernel/finance-audit.service';

/**
 * Finance attachments (plan 5): uploads go to the PRIVATE bucket only and
 * return an object path, never a URL. Reading one issues a signed URL valid
 * for exactly 60 seconds, after writing an `ATTACHMENT_VIEWED` audit row (a
 * failed audit write fails the request, so no view is unaudited). Residents
 * never reach these routes.
 */
@Injectable()
export class FinanceAttachmentsService {
    constructor(
        private readonly db: DatabaseService,
        private readonly audit: FinanceAuditService,
        private readonly files: PrivateFileService
    ) {}

    upload(
        buffer: Buffer,
        actor: IAuthUser
    ): Promise<FinanceAttachmentUploadDto> {
        return this.files.uploadStaging(buffer, actor.userId);
    }

    /**
     * Authorisation (plan 5.2): the path must be the attachment of a payment
     * (any status: voided receipts stay viewable for the audit trail).
     * Unknown paths and payments without an attachment are 404, never 403.
     */
    async signedUrl(
        query: FinanceSignedUrlQueryDto,
        actor: IAuthUser
    ): Promise<FinanceSignedUrlDto> {
        if ((query.paymentId === undefined) === (query.path === undefined))
            throw new BadRequestException(
                'finance.error.attachmentQueryInvalid'
            );
        if (query.path !== undefined && !isFinanceAttachmentPath(query.path))
            throw new NotFoundException('finance.error.attachmentNotFound');

        const payment = await this.db.payment.findFirst({
            where: query.paymentId
                ? { id: query.paymentId }
                : { attachmentPath: query.path },
            select: {
                id: true,
                receiptNo: true,
                attachmentPath: true,
                flat: { select: { id: true, label: true } },
            },
        });
        const path = payment?.attachmentPath;
        if (!payment || !path || !isFinanceAttachmentPath(path))
            throw new NotFoundException('finance.error.attachmentNotFound');

        await this.audit.record(
            this.db,
            actor,
            'ATTACHMENT_VIEWED',
            'Payment',
            payment.id,
            {
                label: `${payment.flat.label} ${payment.receiptNo}`,
                paymentId: payment.id,
                receiptNo: payment.receiptNo,
                flatId: payment.flat.id,
                flatLabel: payment.flat.label,
                ttlSeconds: FINANCE_SIGNED_URL_TTL_SEC,
            }
        );
        const signed = await this.files.createSignedUrl(path);
        return {
            url: signed.url,
            expiresAt: signed.expiresAt,
            expiresInSeconds: FINANCE_SIGNED_URL_TTL_SEC,
        };
    }
}

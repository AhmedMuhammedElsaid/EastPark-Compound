import {
    BadRequestException,
    Body,
    Controller,
    Get,
    Header,
    Headers,
    HttpCode,
    HttpStatus,
    Param,
    Post,
    Query,
    Req,
} from '@nestjs/common';
import {
    ApiBearerAuth,
    ApiConsumes,
    ApiHeader,
    ApiOperation,
    ApiTags,
} from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import type { MultipartFile } from '@fastify/multipart';
import { Role } from '@prisma/client';
import { FastifyRequest } from 'fastify';

import { DocResponse } from 'src/common/doc/decorators/doc.response.decorator';
import { AllowedRoles } from 'src/common/request/decorators/request.role.decorator';
import { AuthUser } from 'src/common/request/decorators/request.user.decorator';
import { IAuthUser } from 'src/common/request/interfaces/request.interface';

import { FinanceVoidDto } from './dtos/request/finance-charge.dto';
import {
    FinanceApplyCreditDto,
    FinanceChequeDateDto,
    FinancePaymentCreateDto,
    FinancePaymentsQueryDto,
    FinanceSignedUrlQueryDto,
} from './dtos/request/finance-payment.dto';
import {
    FinanceApplyCreditResultDto,
    FinanceAttachmentUploadDto,
    FinancePaymentDetailDto,
    FinancePaymentPageDto,
    FinancePaymentResultDto,
    FinanceSignedUrlDto,
} from './dtos/response/finance.response.dto';
import { FinanceAttachmentsService } from './finance-attachments.service';
import { FinancePaymentsService } from './finance-payments.service';
import {
    IDEMPOTENCY_HEADER,
    requireIdempotencyKey,
} from './kernel/idempotency';

/** Plan 7.7 rate limits (per client IP: the throttler runs before auth). */
const PAYMENT_CREATE_THROTTLE = { default: { limit: 60, ttl: 60_000 } };
const SIGNED_URL_THROTTLE = { default: { limit: 30, ttl: 60_000 } };
const ATTACHMENT_UPLOAD_THROTTLE = { default: { limit: 30, ttl: 60_000 } };

type MultipartRequest = FastifyRequest & {
    file: () => Promise<MultipartFile | undefined>;
};

// Finance desk: ACCOUNTANT + ADMIN (SUPER_ADMIN satisfies ADMIN in the guard).
@ApiTags('finance/payments')
@ApiBearerAuth('accessToken')
@Controller({ path: '/finance/payments', version: '1' })
export class FinancePaymentsController {
    constructor(private readonly payments: FinancePaymentsService) {}

    @Post()
    @AllowedRoles([Role.ACCOUNTANT, Role.ADMIN])
    @Throttle(PAYMENT_CREATE_THROTTLE)
    @HttpCode(HttpStatus.CREATED)
    @ApiHeader({
        name: 'Idempotency-Key',
        required: true,
        description:
            'Client-generated key (UUID). Re-send the SAME key on a retry; it returns the original receipt.',
    })
    @DocResponse({
        httpStatus: HttpStatus.CREATED,
        messageKey: 'finance.success.paymentRecorded',
    })
    @ApiOperation({
        summary:
            'Record a payment: receipt number, auto (oldest due first, deposits skipped) or explicit allocations, rest as credit [ACCOUNTANT, ADMIN]',
    })
    create(
        @Body() dto: FinancePaymentCreateDto,
        @Headers(IDEMPOTENCY_HEADER) idempotencyKey: string | undefined,
        @AuthUser() actor: IAuthUser
    ): Promise<FinancePaymentResultDto> {
        const key = requireIdempotencyKey(idempotencyKey);
        return this.payments.create(dto, key, actor);
    }

    @Get()
    @AllowedRoles([Role.ACCOUNTANT, Role.ADMIN])
    @ApiOperation({
        summary:
            'Payments, newest cash date first (cursor) [ACCOUNTANT, ADMIN]',
    })
    list(
        @Query() query: FinancePaymentsQueryDto
    ): Promise<FinancePaymentPageDto> {
        return this.payments.list(query);
    }

    @Get(':id')
    @AllowedRoles([Role.ACCOUNTANT, Role.ADMIN])
    @ApiOperation({
        summary:
            'Payment with its allocations and attachment flag [ACCOUNTANT, ADMIN]',
    })
    detail(@Param('id') id: string): Promise<FinancePaymentDetailDto> {
        return this.payments.detail(id);
    }

    @Post(':id/void')
    @AllowedRoles([Role.ACCOUNTANT, Role.ADMIN])
    @HttpCode(HttpStatus.OK)
    @DocResponse({
        httpStatus: HttpStatus.OK,
        messageKey: 'finance.success.paymentVoided',
    })
    @ApiOperation({
        summary:
            'Void a payment and its allocations. ACCOUNTANT: own entry, same Cairo day; ADMIN: any. Periods must be open [ACCOUNTANT, ADMIN]',
    })
    void(
        @Param('id') id: string,
        @Body() dto: FinanceVoidDto,
        @AuthUser() actor: IAuthUser
    ): Promise<FinancePaymentDetailDto> {
        return this.payments.void(id, dto.reason, actor);
    }

    @Post(':id/cheque-cleared')
    @AllowedRoles([Role.ACCOUNTANT, Role.ADMIN])
    @HttpCode(HttpStatus.OK)
    @DocResponse({
        httpStatus: HttpStatus.OK,
        messageKey: 'finance.success.chequeCleared',
    })
    @ApiOperation({
        summary: 'Mark a pending cheque cleared on a date [ACCOUNTANT, ADMIN]',
    })
    chequeCleared(
        @Param('id') id: string,
        @Body() dto: FinanceChequeDateDto,
        @AuthUser() actor: IAuthUser
    ): Promise<FinancePaymentDetailDto> {
        return this.payments.chequeCleared(id, dto, actor);
    }

    @Post(':id/cheque-bounced')
    @AllowedRoles([Role.ACCOUNTANT, Role.ADMIN])
    @HttpCode(HttpStatus.OK)
    @DocResponse({
        httpStatus: HttpStatus.OK,
        messageKey: 'finance.success.chequeBounced',
    })
    @ApiOperation({
        summary:
            'Mark a pending cheque bounced on a date: not live from that date, its allocations reopen [ACCOUNTANT, ADMIN]',
    })
    chequeBounced(
        @Param('id') id: string,
        @Body() dto: FinanceChequeDateDto,
        @AuthUser() actor: IAuthUser
    ): Promise<FinancePaymentDetailDto> {
        return this.payments.chequeBounced(id, dto, actor);
    }
}

@ApiTags('finance/flats')
@ApiBearerAuth('accessToken')
@Controller({ path: '/finance/flats', version: '1' })
export class FinanceCreditController {
    constructor(private readonly payments: FinancePaymentsService) {}

    @Post(':id/apply-credit')
    @AllowedRoles([Role.ACCOUNTANT, Role.ADMIN])
    @HttpCode(HttpStatus.OK)
    @DocResponse({
        httpStatus: HttpStatus.OK,
        messageKey: 'finance.success.creditApplied',
    })
    @ApiOperation({
        summary:
            "Apply the flat's credit to open charges, dated today [ACCOUNTANT, ADMIN]",
    })
    applyCredit(
        @Param('id') id: string,
        @Body() dto: FinanceApplyCreditDto,
        @AuthUser() actor: IAuthUser
    ): Promise<FinanceApplyCreditResultDto> {
        return this.payments.applyCredit(id, dto, actor);
    }
}

@ApiTags('finance/attachments')
@ApiBearerAuth('accessToken')
@Controller({ path: '/finance/attachments', version: '1' })
export class FinanceAttachmentsController {
    constructor(private readonly attachments: FinanceAttachmentsService) {}

    @Post()
    @AllowedRoles([Role.ACCOUNTANT, Role.ADMIN])
    @Throttle(ATTACHMENT_UPLOAD_THROTTLE)
    @HttpCode(HttpStatus.CREATED)
    @ApiConsumes('multipart/form-data')
    @DocResponse({
        httpStatus: HttpStatus.CREATED,
        messageKey: 'finance.success.attachmentUploaded',
    })
    @ApiOperation({
        summary:
            'Upload a payment slip / cheque photo (jpg/png/webp <= 5 MB, pdf <= 10 MB) to PRIVATE storage; returns { path } [ACCOUNTANT, ADMIN]',
    })
    async upload(
        @Req() req: MultipartRequest,
        @AuthUser() actor: IAuthUser
    ): Promise<FinanceAttachmentUploadDto> {
        const data = await req.file();
        if (!data) throw new BadRequestException('finance.error.noFile');
        const buffer = await data.toBuffer();
        return this.attachments.upload(buffer, actor);
    }

    @Get('signed-url')
    @AllowedRoles([Role.ACCOUNTANT, Role.ADMIN])
    @Throttle(SIGNED_URL_THROTTLE)
    @Header('Cache-Control', 'no-store')
    @ApiOperation({
        summary:
            'A 60-second signed URL for a payment attachment (?paymentId= or ?path=); every issue is audited [ACCOUNTANT, ADMIN]',
    })
    signedUrl(
        @Query() query: FinanceSignedUrlQueryDto,
        @AuthUser() actor: IAuthUser
    ): Promise<FinanceSignedUrlDto> {
        return this.attachments.signedUrl(query, actor);
    }
}

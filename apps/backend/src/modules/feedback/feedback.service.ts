import {
    ForbiddenException,
    Injectable,
    NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import { isAdminRole } from 'src/common/auth/utils/roles';
import { DatabaseService } from 'src/common/database/services/database.service';
import { assertStoragePublicUrls } from 'src/common/file/storage-url';
import { cursorArgs, toCursorPage } from 'src/common/helper/pagination';
import { IAuthUser } from 'src/common/request/interfaces/request.interface';
import { AuditService } from 'src/modules/audit/audit.service';

import { FeedbackCreateDto } from './dtos/request/feedback.create.dto';
import { FeedbackQueryDto } from './dtos/request/feedback.query.dto';
import { FeedbackReplyDto } from './dtos/request/feedback.reply.dto';
import { FeedbackUpdateStatusDto } from './dtos/request/feedback.update-status.dto';
import {
    FeedbackDetailResponseDto,
    FeedbackListResponseDto,
    FeedbackReplyResponseDto,
    FeedbackResponseDto,
} from './dtos/response/feedback.response.dto';

/** Activity-log label: category plus a short ref (feedback has no title). */
export function feedbackLabel(feedback: {
    id: string;
    category: string;
}): string {
    // Never the body: free text can hold a phone or national id, and the
    // audit row outlives account deletion.
    return `${feedback.category} #${feedback.id.slice(-6).toUpperCase()}`;
}

@Injectable()
export class FeedbackService {
    constructor(
        private readonly db: DatabaseService,
        private readonly config: ConfigService,
        private readonly audit: AuditService
    ) {}

    private maskAnonymous(
        feedback: FeedbackResponseDto & { userId?: string | null },
        actor: IAuthUser
    ): FeedbackResponseDto {
        if (feedback.isAnonymous && !isAdminRole(actor.role)) {
            return { ...feedback, userId: null };
        }
        return feedback;
    }

    async create(
        dto: FeedbackCreateDto,
        actor: IAuthUser
    ): Promise<FeedbackResponseDto> {
        // Attachments must be images uploaded through /uploads (our bucket).
        assertStoragePublicUrls(
            this.config,
            dto.attachments ?? [],
            'file.error.urlNotStored'
        );

        return this.db.feedback.create({
            data: {
                ...dto,
                userId: actor.userId,
                attachments: dto.attachments ?? [],
            },
        });
    }

    async findAll(
        query: FeedbackQueryDto,
        actor: IAuthUser
    ): Promise<FeedbackListResponseDto> {
        const limit = query.limit ?? 20;

        const where: Record<string, unknown> =
            isAdminRole(actor.role) ? {} : { userId: actor.userId };
        if (query.category) where['category'] = query.category;
        if (query.status) where['status'] = query.status;

        const rows = await this.db.feedback.findMany({
            where,
            take: limit + 1,
            ...cursorArgs(query.cursor),
            orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        });

        const { items, nextCursor } = toCursorPage(rows, limit);

        return {
            items: items.map(f => this.maskAnonymous(f, actor)),
            nextCursor,
        };
    }

    async findOne(
        id: string,
        actor: IAuthUser
    ): Promise<FeedbackDetailResponseDto> {
        const feedback = await this.db.feedback.findUnique({
            where: { id },
            include: {
                replies: {
                    orderBy: { createdAt: 'asc' },
                    select: {
                        id: true,
                        body: true,
                        authorId: true,
                        createdAt: true,
                    },
                },
            },
        });

        if (!feedback) throw new NotFoundException('feedback.error.notFound');

        // Only admins can see any feedback — all other roles are limited to their own
        if (!isAdminRole(actor.role) && feedback.userId !== actor.userId) {
            throw new ForbiddenException('feedback.error.forbidden');
        }

        const masked = this.maskAnonymous(feedback, actor);
        return { ...masked, replies: feedback.replies };
    }

    async addReply(
        id: string,
        dto: FeedbackReplyDto,
        actor: IAuthUser
    ): Promise<FeedbackReplyResponseDto> {
        const feedback = await this.db.feedback.findUnique({ where: { id } });
        if (!feedback) throw new NotFoundException('feedback.error.notFound');

        const reply = await this.db.feedbackReply.create({
            data: { body: dto.body, feedbackId: id, authorId: actor.userId },
            select: { id: true, body: true, authorId: true, createdAt: true },
        });

        await this.audit.record(actor, 'FEEDBACK_REPLIED', 'Feedback', id, {
            label: feedbackLabel(feedback),
        });

        return reply;
    }

    async updateStatus(
        id: string,
        dto: FeedbackUpdateStatusDto,
        actor?: IAuthUser
    ): Promise<FeedbackResponseDto> {
        const feedback = await this.db.feedback.findUnique({ where: { id } });
        if (!feedback) throw new NotFoundException('feedback.error.notFound');

        const updated = await this.db.feedback.update({
            where: { id },
            data: { status: dto.status },
        });

        if (feedback.status !== updated.status) {
            await this.audit.record(
                actor,
                'FEEDBACK_STATUS_CHANGED',
                'Feedback',
                id,
                { label: feedbackLabel(feedback), status: updated.status }
            );
        }

        return updated;
    }
}

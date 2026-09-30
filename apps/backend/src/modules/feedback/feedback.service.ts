import {
    ForbiddenException,
    Injectable,
    NotFoundException,
} from '@nestjs/common';
import { Role } from '@prisma/client';

import { DatabaseService } from 'src/common/database/services/database.service';
import { IAuthUser } from 'src/common/request/interfaces/request.interface';

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

@Injectable()
export class FeedbackService {
    constructor(private readonly db: DatabaseService) {}

    private maskAnonymous(
        feedback: FeedbackResponseDto & { userId?: string | null },
        actor: IAuthUser
    ): FeedbackResponseDto {
        if (feedback.isAnonymous && actor.role !== Role.ADMIN) {
            return { ...feedback, userId: null };
        }
        return feedback;
    }

    async create(
        dto: FeedbackCreateDto,
        actor: IAuthUser
    ): Promise<FeedbackResponseDto> {
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
            actor.role === Role.ADMIN ? {} : { userId: actor.userId };
        if (query.category) where['category'] = query.category;
        if (query.status) where['status'] = query.status;

        const items = await this.db.feedback.findMany({
            where,
            take: limit + 1,
            ...(query.cursor ? { skip: 1, cursor: { id: query.cursor } } : {}),
            orderBy: { createdAt: 'desc' },
        });

        let nextCursor: string | undefined;
        if (items.length > limit) {
            const last = items.pop();
            nextCursor = last?.id;
        }

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
        if (actor.role !== Role.ADMIN && feedback.userId !== actor.userId) {
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

        return this.db.feedbackReply.create({
            data: { body: dto.body, feedbackId: id, authorId: actor.userId },
            select: { id: true, body: true, authorId: true, createdAt: true },
        });
    }

    async updateStatus(
        id: string,
        dto: FeedbackUpdateStatusDto
    ): Promise<FeedbackResponseDto> {
        const feedback = await this.db.feedback.findUnique({ where: { id } });
        if (!feedback) throw new NotFoundException('feedback.error.notFound');

        return this.db.feedback.update({
            where: { id },
            data: { status: dto.status },
        });
    }
}

import { Injectable, NotFoundException } from '@nestjs/common';
import { Role } from '@prisma/client';

import { DatabaseService } from 'src/common/database/services/database.service';
import { cursorArgs, toCursorPage } from 'src/common/helper/pagination';
import { IAuthUser } from 'src/common/request/interfaces/request.interface';

import { AnnouncementCreateDto } from './dtos/request/announcement.create.dto';
import { AnnouncementQueryDto } from './dtos/request/announcement.query.dto';
import { CommentCreateDto } from './dtos/request/comment.create.dto';
import {
    AnnouncementDetailResponseDto,
    AnnouncementListResponseDto,
    AnnouncementResponseDto,
    CommentResponseDto,
} from './dtos/response/announcement.response.dto';

/** Comments embedded in `GET /announcements/:id`: the latest N, oldest first. */
export const ANNOUNCEMENT_COMMENTS_LIMIT = 100;

@Injectable()
export class AnnouncementsService {
    constructor(private readonly db: DatabaseService) {}

    async create(dto: AnnouncementCreateDto): Promise<AnnouncementResponseDto> {
        return this.db.announcement.create({
            data: {
                ...dto,
                publishedAt: dto.publishedAt ?? new Date(),
            },
        });
    }

    async findAll(
        query: AnnouncementQueryDto
    ): Promise<AnnouncementListResponseDto> {
        const limit = query.limit ?? 20;

        const rows = await this.db.announcement.findMany({
            where: query.category ? { category: query.category } : {},
            take: limit + 1,
            ...cursorArgs(query.cursor),
            orderBy: [{ publishedAt: 'desc' }, { id: 'desc' }],
        });

        const { items, nextCursor } = toCursorPage(rows, limit);

        return { items, nextCursor };
    }

    async findOne(
        id: string,
        actor?: IAuthUser
    ): Promise<AnnouncementDetailResponseDto> {
        const announcement = await this.db.announcement.findUnique({
            where: { id },
            include: {
                // Newest ANNOUNCEMENT_COMMENTS_LIMIT only (reversed below so the
                // response stays oldest-first, as before).
                comments: {
                    orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
                    take: ANNOUNCEMENT_COMMENTS_LIMIT,
                    select: {
                        id: true,
                        body: true,
                        userId: true,
                        createdAt: true,
                        user: { select: { id: true, name: true } },
                    },
                },
            },
        });
        if (!announcement)
            throw new NotFoundException('announcement.error.notFound');

        // Privacy: guests see first names only; internal user ids are exposed
        // only to the comment owner and admins.
        const comments = [...announcement.comments].reverse().map(comment => {
            const canSeeIdentity =
                !!actor &&
                (actor.role === Role.ADMIN || actor.userId === comment.userId);
            const fullName = comment.user?.name ?? '';
            const name = actor
                ? fullName
                : (fullName.trim().split(/\s+/)[0] ?? '');
            return {
                id: comment.id,
                body: comment.body,
                createdAt: comment.createdAt,
                ...(canSeeIdentity ? { userId: comment.userId } : {}),
                user: {
                    ...(canSeeIdentity ? { id: comment.user?.id } : {}),
                    name,
                },
            };
        });

        return { ...announcement, comments } as AnnouncementDetailResponseDto;
    }

    async addComment(
        id: string,
        dto: CommentCreateDto,
        actor: IAuthUser
    ): Promise<CommentResponseDto> {
        const announcement = await this.db.announcement.findUnique({
            where: { id },
        });
        if (!announcement)
            throw new NotFoundException('announcement.error.notFound');

        return this.db.comment.create({
            data: { body: dto.body, userId: actor.userId, announcementId: id },
            select: {
                id: true,
                body: true,
                userId: true,
                createdAt: true,
                user: { select: { id: true, name: true } },
            },
        }) as Promise<CommentResponseDto>;
    }
}

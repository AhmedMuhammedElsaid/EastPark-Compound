import { Injectable, NotFoundException } from '@nestjs/common';

import { DatabaseService } from 'src/common/database/services/database.service';
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

        const items = await this.db.announcement.findMany({
            where: query.category ? { category: query.category } : {},
            take: limit + 1,
            ...(query.cursor ? { skip: 1, cursor: { id: query.cursor } } : {}),
            orderBy: { publishedAt: 'desc' },
        });

        let nextCursor: string | undefined;
        if (items.length > limit) {
            const last = items.pop();
            nextCursor = last?.id;
        }

        return { items, nextCursor };
    }

    async findOne(id: string): Promise<AnnouncementDetailResponseDto> {
        const announcement = await this.db.announcement.findUnique({
            where: { id },
            include: {
                comments: {
                    orderBy: { createdAt: 'asc' },
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
        return announcement as AnnouncementDetailResponseDto;
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

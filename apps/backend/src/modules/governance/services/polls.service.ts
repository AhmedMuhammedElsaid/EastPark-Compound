import {
    BadRequestException,
    ConflictException,
    Injectable,
    NotFoundException,
} from '@nestjs/common';

import { DatabaseService } from 'src/common/database/services/database.service';
import { IAuthUser } from 'src/common/request/interfaces/request.interface';

import { PollCreateDto } from '../dtos/request/poll.create.dto';
import { PollVoteDto } from '../dtos/request/poll.vote.dto';
import { GovernanceQueryDto } from '../dtos/request/governance.query.dto';
import {
    PollListResponseDto,
    PollResponseDto,
} from '../dtos/response/poll.response.dto';

@Injectable()
export class PollsService {
    constructor(private readonly db: DatabaseService) {}

    async create(dto: PollCreateDto): Promise<PollResponseDto> {
        const poll = await this.db.poll.create({
            data: {
                question: dto.question,
                questionAr: dto.questionAr,
                expiresAt: dto.expiresAt,
                options: { create: dto.options },
            },
            include: { options: true },
        });

        return { ...poll, options: poll.options };
    }

    async findAll(
        query: GovernanceQueryDto,
        actor?: IAuthUser
    ): Promise<PollListResponseDto> {
        const limit = query.limit ?? 20;

        const polls = await this.db.poll.findMany({
            take: limit + 1,
            ...(query.cursor ? { skip: 1, cursor: { id: query.cursor } } : {}),
            orderBy: { createdAt: 'desc' },
            include: {
                options: {
                    include: { _count: { select: { votes: true } } },
                },
                votes: actor ? { where: { userId: actor.userId } } : false,
            },
        });

        let nextCursor: string | undefined;
        if (polls.length > limit) {
            const last = polls.pop();
            nextCursor = last?.id;
        }

        const now = new Date();
        const items = polls.map(poll => {
            const isExpired = poll.expiresAt <= now;
            const myVote =
                poll.votes && poll.votes.length > 0 ? poll.votes[0] : null;

            return {
                id: poll.id,
                question: poll.question,
                questionAr: poll.questionAr,
                expiresAt: poll.expiresAt,
                createdAt: poll.createdAt,
                options: poll.options.map(opt => ({
                    id: opt.id,
                    label: opt.label,
                    labelAr: opt.labelAr,
                    // Show vote counts only after poll expires
                    ...(isExpired ? { voteCount: opt._count.votes } : {}),
                })),
                myVoteOptionId: myVote?.optionId ?? null,
            };
        });

        return { items, nextCursor };
    }

    async findOne(id: string, actor?: IAuthUser): Promise<PollResponseDto> {
        const poll = await this.db.poll.findUnique({
            where: { id },
            include: {
                options: {
                    include: { _count: { select: { votes: true } } },
                },
                votes: actor ? { where: { userId: actor.userId } } : false,
            },
        });

        if (!poll) throw new NotFoundException('poll.error.notFound');

        const isExpired = poll.expiresAt <= new Date();
        const myVote =
            poll.votes && poll.votes.length > 0 ? poll.votes[0] : null;

        return {
            id: poll.id,
            question: poll.question,
            questionAr: poll.questionAr,
            expiresAt: poll.expiresAt,
            createdAt: poll.createdAt,
            options: poll.options.map(opt => ({
                id: opt.id,
                label: opt.label,
                labelAr: opt.labelAr,
                ...(isExpired ? { voteCount: opt._count.votes } : {}),
            })),
            myVoteOptionId: myVote?.optionId ?? null,
        };
    }

    async vote(
        id: string,
        dto: PollVoteDto,
        actor: IAuthUser
    ): Promise<{ message: string }> {
        const poll = await this.db.poll.findUnique({
            where: { id },
            include: { options: { select: { id: true } } },
        });
        if (!poll) throw new NotFoundException('poll.error.notFound');

        if (poll.expiresAt <= new Date()) {
            throw new BadRequestException('poll.error.expired');
        }

        // Check if option belongs to this poll
        const validOption = poll.options.some(o => o.id === dto.optionId);
        if (!validOption)
            throw new NotFoundException('poll.error.optionNotFound');

        // One vote per resident per poll — enforced by DB @@id([userId, pollId])
        const existing = await this.db.vote.findUnique({
            where: { userId_pollId: { userId: actor.userId, pollId: id } },
        });
        if (existing) throw new ConflictException('poll.error.alreadyVoted');

        await this.db.vote.create({
            data: { userId: actor.userId, pollId: id, optionId: dto.optionId },
        });

        return { message: 'poll.success.voted' };
    }
}

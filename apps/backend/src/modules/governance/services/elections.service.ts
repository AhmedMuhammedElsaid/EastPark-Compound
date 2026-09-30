import {
    BadRequestException,
    ConflictException,
    Injectable,
    Logger,
    NotFoundException,
} from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { ElectionVisibilityMode } from '@prisma/client';

import { DatabaseService } from 'src/common/database/services/database.service';
import { IAuthUser } from 'src/common/request/interfaces/request.interface';

import { CandidateCreateDto } from '../dtos/request/candidate.create.dto';
import { ElectionCreateDto } from '../dtos/request/election.create.dto';
import { ElectionVoteDto } from '../dtos/request/election.vote.dto';
import { GovernanceQueryDto } from '../dtos/request/governance.query.dto';
import {
    CandidateResponseDto,
    ElectionListResponseDto,
    ElectionResponseDto,
} from '../dtos/response/election.response.dto';

@Injectable()
export class ElectionsService {
    private readonly logger = new Logger(ElectionsService.name);

    constructor(private readonly db: DatabaseService) {}

    /** Auto-open results every 5 minutes when expiresAt has passed */
    @Cron('*/5 * * * *')
    async openExpiredResults(): Promise<void> {
        const updated = await this.db.election.updateMany({
            where: {
                resultsOpen: false,
                expiresAt: { lte: new Date() },
                visibilityMode: { not: ElectionVisibilityMode.ADMIN_CONTROLLED },
            },
            data: { resultsOpen: true },
        });

        if (updated.count > 0) {
            this.logger.log(
                `Opened results for ${updated.count} expired election(s)`
            );
        }
    }

    async create(dto: ElectionCreateDto): Promise<ElectionResponseDto> {
        const election = await this.db.election.create({
            data: {
                title: dto.title,
                titleAr: dto.titleAr,
                description: dto.description,
                descriptionAr: dto.descriptionAr,
                expiresAt: dto.expiresAt,
                visibilityMode: dto.visibilityMode ?? ElectionVisibilityMode.SEALED_UNTIL_DEADLINE,
            },
            include: { candidates: true },
        });

        return this.buildElectionDto(election, null);
    }

    async addCandidate(
        electionId: string,
        dto: CandidateCreateDto
    ): Promise<CandidateResponseDto> {
        const election = await this.db.election.findUnique({
            where: { id: electionId },
        });
        if (!election) throw new NotFoundException('election.error.notFound');

        return this.db.candidate.create({
            data: { ...dto, electionId },
        });
    }

    private buildElectionDto(
        election: any,
        myVoteCandidateId: string | null
    ): ElectionResponseDto {
        const showResults = election.resultsOpen || election.visibilityMode === ElectionVisibilityMode.LIVE_COUNT;
        return {
            id: election.id,
            title: election.title,
            titleAr: election.titleAr,
            description: election.description,
            descriptionAr: election.descriptionAr ?? null,
            expiresAt: election.expiresAt,
            resultsOpen: election.resultsOpen,
            visibilityMode: election.visibilityMode,
            createdAt: election.createdAt,
            candidates: election.candidates.map((c: any) => ({
                id: c.id,
                name: c.name,
                nameAr: c.nameAr,
                statement: c.statement,
                statementAr: c.statementAr,
                photoUrl: c.photoUrl,
                ...(showResults ? { voteCount: c._count?.votes ?? 0 } : {}),
            })),
            myVoteCandidateId,
        };
    }

    async findAll(
        query: GovernanceQueryDto,
        actor?: IAuthUser
    ): Promise<ElectionListResponseDto> {
        const limit = query.limit ?? 20;

        const elections = await this.db.election.findMany({
            take: limit + 1,
            ...(query.cursor ? { skip: 1, cursor: { id: query.cursor } } : {}),
            orderBy: { createdAt: 'desc' },
            include: {
                candidates: {
                    include: { _count: { select: { votes: true } } },
                },
                votes: actor ? { where: { userId: actor.userId } } : false,
            },
        });

        let nextCursor: string | undefined;
        if (elections.length > limit) {
            const last = elections.pop();
            nextCursor = last?.id;
        }

        const items = elections.map(election => {
            const myVote =
                election.votes && election.votes.length > 0
                    ? election.votes[0]
                    : null;
            return this.buildElectionDto(election, myVote?.candidateId ?? null);
        });

        return { items, nextCursor };
    }

    async findOne(id: string, actor?: IAuthUser): Promise<ElectionResponseDto> {
        const election = await this.db.election.findUnique({
            where: { id },
            include: {
                candidates: {
                    include: { _count: { select: { votes: true } } },
                },
                votes: actor ? { where: { userId: actor.userId } } : false,
            },
        });

        if (!election) throw new NotFoundException('election.error.notFound');

        const myVote =
            election.votes && election.votes.length > 0
                ? election.votes[0]
                : null;
        return this.buildElectionDto(election, myVote?.candidateId ?? null);
    }

    async vote(
        id: string,
        dto: ElectionVoteDto,
        actor: IAuthUser
    ): Promise<{ message: string }> {
        const election = await this.db.election.findUnique({
            where: { id },
            include: { candidates: { select: { id: true } } },
        });
        if (!election) throw new NotFoundException('election.error.notFound');

        if (election.expiresAt <= new Date()) {
            throw new BadRequestException('election.error.expired');
        }

        const validCandidate = election.candidates.some(
            c => c.id === dto.candidateId
        );
        if (!validCandidate)
            throw new NotFoundException('election.error.candidateNotFound');

        // One vote per resident per election — @@id([userId, electionId])
        const existing = await this.db.electionVote.findUnique({
            where: {
                userId_electionId: { userId: actor.userId, electionId: id },
            },
        });
        if (existing)
            throw new ConflictException('election.error.alreadyVoted');

        await this.db.electionVote.create({
            data: {
                userId: actor.userId,
                electionId: id,
                candidateId: dto.candidateId,
            },
        });

        return { message: 'election.success.voted' };
    }
}

import { ConflictException, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as crypto from 'node:crypto';

import { DatabaseService } from 'src/common/database/services/database.service';
import { EmailService } from 'src/common/email/email.service';
import { IAuthUser } from 'src/common/request/interfaces/request.interface';

import { InvitationCreateDto } from './dtos/request/invitation.create.dto';
import { InvitationQueryDto } from './dtos/request/invitation.query.dto';
import {
    InvitationListResponseDto,
    InvitationResponseDto,
} from './dtos/response/invitation.response.dto';

@Injectable()
export class InvitationsService {
    constructor(
        private readonly db: DatabaseService,
        private readonly email: EmailService,
        private readonly config: ConfigService,
    ) {}

    async create(dto: InvitationCreateDto, actor: IAuthUser): Promise<InvitationResponseDto> {
        // Check for existing active (unused, non-expired) invitation
        const existing = await this.db.invitation.findFirst({
            where: {
                email: dto.email,
                role: dto.role,
                usedAt: null,
                expiresAt: { gt: new Date() },
            },
        });
        if (existing) {
            throw new ConflictException('invitation.error.alreadyPending');
        }

        const token = crypto.randomBytes(32).toString('hex');
        const expiresAt = new Date(Date.now() + 48 * 3600 * 1000);

        const invitation = await this.db.invitation.create({
            data: {
                email: dto.email,
                role: dto.role,
                token,
                expiresAt,
                invitedById: actor.userId,
            },
        });

        const appUrl = this.config.get<string>('app.url') ?? '';
        const inviteUrl = `${appUrl}/auth/accept-invitation?token=${token}`;
        await this.email.sendInvitation(dto.email, inviteUrl, dto.role);

        // Never return the token
        return {
            id: invitation.id,
            email: invitation.email,
            role: invitation.role,
            expiresAt: invitation.expiresAt,
            usedAt: invitation.usedAt,
            createdAt: invitation.createdAt,
        };
    }

    async findAll(query: InvitationQueryDto): Promise<InvitationListResponseDto> {
        const limit = query.limit ?? 20;

        const items = await this.db.invitation.findMany({
            take: limit + 1,
            ...(query.cursor ? { skip: 1, cursor: { id: query.cursor } } : {}),
            orderBy: { createdAt: 'desc' },
            select: {
                id: true,
                email: true,
                role: true,
                expiresAt: true,
                usedAt: true,
                createdAt: true,
                // token intentionally omitted
            },
        });

        let nextCursor: string | undefined;
        if (items.length > limit) {
            const last = items.pop();
            nextCursor = last?.id;
        }

        return { items, nextCursor };
    }
}

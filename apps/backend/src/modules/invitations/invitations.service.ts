import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as crypto from 'node:crypto';

import { DatabaseService } from 'src/common/database/services/database.service';
import { cursorArgs, toCursorPage } from 'src/common/helper/pagination';
import { EmailService } from 'src/common/email/email.service';
import { normalizeEmail } from 'src/common/helper/transforms/normalize-email.transform';
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
        // Normalized here too: ResidentsService calls this programmatically,
        // bypassing the DTO transform. accept-invitation and login look users
        // up by the lower-cased email, so the stored invitation must match.
        const email = normalizeEmail(dto.email);

        // Check for existing active (unused, non-expired) invitation
        const existing = await this.db.invitation.findFirst({
            where: {
                email,
                role: dto.role,
                usedAt: null,
                expiresAt: { gt: new Date() },
            },
        });
        if (existing) {
            await this.sendInvitation(existing.email, existing.token, existing.role);
            return {
                id: existing.id,
                email: existing.email,
                role: existing.role,
                expiresAt: existing.expiresAt,
                usedAt: existing.usedAt,
                createdAt: existing.createdAt,
            };
        }

        const token = crypto.randomBytes(32).toString('hex');
        const expiresAt = new Date(Date.now() + 48 * 3600 * 1000);

        const invitation = await this.db.invitation.create({
            data: {
                email,
                role: dto.role,
                token,
                expiresAt,
                invitedById: actor.userId,
            },
        });

        await this.sendInvitation(email, token, dto.role);

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

        const rows = await this.db.invitation.findMany({
            take: limit + 1,
            ...cursorArgs(query.cursor),
            orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
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

        const { items, nextCursor } = toCursorPage(rows, limit);

        return { items, nextCursor };
    }

    private sendInvitation(email: string, token: string, role: string): Promise<void> {
        const webUrl = this.config.get<string>('app.webUrl') ?? 'http://localhost:3000';
        const inviteUrl = `${webUrl}/auth/accept-invitation?token=${token}`;
        return this.email.sendInvitation(email, inviteUrl, role);
    }
}

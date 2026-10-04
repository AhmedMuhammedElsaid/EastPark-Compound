import {
    ConflictException,
    Injectable,
    NotFoundException,
} from '@nestjs/common';
import { ResidentLead, ResidentLeadStatus, Role } from '@prisma/client';

import {
    isPrismaError,
    PRISMA_UNIQUE_VIOLATION,
} from 'src/common/database/prisma-errors';
import { DatabaseService } from 'src/common/database/services/database.service';
import { cursorArgs, toCursorPage } from 'src/common/helper/pagination';
import { IAuthUser } from 'src/common/request/interfaces/request.interface';
import { AuditService } from 'src/modules/audit/audit.service';
import { InvitationsService } from 'src/modules/invitations/invitations.service';

import { ResidentLeadCreateDto } from './dtos/request/resident-lead.create.dto';
import { ResidentLeadQueryDto } from './dtos/request/resident-lead.query.dto';
import {
    ResidentLeadListResponseDto,
    ResidentLeadResponseDto,
    ResidentLeadStatsResponseDto,
} from './dtos/response/resident-lead.response.dto';

function isSameSubmission(
    existing: ResidentLeadResponseDto,
    dto: ResidentLeadCreateDto,
    name: string,
    email: string
): boolean {
    return (
        existing.name === name &&
        existing.email === email &&
        existing.phone === dto.phone &&
        (existing.parking ?? undefined) === dto.parking &&
        (existing.jobTitle ?? undefined) === dto.jobTitle?.trim() &&
        (existing.maritalStatus ?? undefined) === dto.maritalStatus &&
        (existing.nationalId ?? undefined) === dto.nationalId?.trim() &&
        (existing.passportNumber ?? undefined) === dto.passportNumber?.trim()
    );
}

@Injectable()
export class ResidentsService {
    constructor(
        private readonly db: DatabaseService,
        private readonly invitationsService: InvitationsService,
        private readonly audit: AuditService
    ) {}

    async create(dto: ResidentLeadCreateDto): Promise<ResidentLeadResponseDto> {
        const email = dto.email.toLowerCase().trim();
        const name = dto.name.trim();

        const existing = await this.db.residentLead.findFirst({
            where: {
                building: dto.building,
                floor: dto.floor,
                flatNumber: dto.flatNumber,
                status: { not: ResidentLeadStatus.REJECTED },
            },
        });

        if (existing) {
            if (isSameSubmission(existing, dto, name, email)) return existing;
            throw new ConflictException('residentLead.error.unitReserved');
        }

        try {
            return await this.db.residentLead.create({
                data: {
                    name,
                    email,
                    phone: dto.phone,
                    building: dto.building,
                    floor: dto.floor,
                    flatNumber: dto.flatNumber,
                    parking: dto.parking,
                    jobTitle: dto.jobTitle?.trim(),
                    maritalStatus: dto.maritalStatus,
                    nationalId: dto.nationalId?.trim(),
                    passportNumber: dto.passportNumber?.trim(),
                    status: ResidentLeadStatus.PENDING,
                },
            });
        } catch (error) {
            if (isPrismaError(error, PRISMA_UNIQUE_VIOLATION)) {
                const concurrent = await this.db.residentLead.findFirst({
                    where: {
                        building: dto.building,
                        floor: dto.floor,
                        flatNumber: dto.flatNumber,
                        status: { not: ResidentLeadStatus.REJECTED },
                    },
                });

                if (
                    concurrent &&
                    isSameSubmission(concurrent, dto, name, email)
                ) {
                    return concurrent;
                }
                throw new ConflictException('residentLead.error.unitReserved');
            }
            throw error;
        }
    }

    async findAll(
        query: ResidentLeadQueryDto
    ): Promise<ResidentLeadListResponseDto> {
        const limit = query.limit ?? 20;

        const rows = await this.db.residentLead.findMany({
            where: {
                ...(query.status ? { status: query.status } : {}),
            },
            take: limit + 1,
            ...cursorArgs(query.cursor),
            orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        });

        const { items, nextCursor } = toCursorPage(rows, limit);

        return { items, nextCursor };
    }

    /** Lead counts per status (zero-filled) plus the overall total. */
    async stats(): Promise<ResidentLeadStatsResponseDto> {
        const groups = await this.db.residentLead.groupBy({
            by: ['status'],
            _count: { _all: true },
        });
        const counts: ResidentLeadStatsResponseDto = {
            PENDING: 0,
            INVITED: 0,
            CONVERTED: 0,
            REJECTED: 0,
            total: 0,
        };
        for (const group of groups) {
            counts[group.status] = group._count._all;
            counts.total += group._count._all;
        }
        return counts;
    }

    /**
     * Invite a lead to register. If a User already exists for the lead's
     * email, we just link + mark CONVERTED — we never create a second
     * invitation or touch the existing account.
     */
    async invite(id: string, actor: IAuthUser): Promise<{ message: string }> {
        const lead = await this.db.residentLead.findUnique({ where: { id } });
        if (!lead) throw new NotFoundException('residentLead.error.notFound');

        // Re-activating a REJECTED lead must not collide with a newer active
        // lead for the same unit (partial unique index). Checked before any
        // invitation email goes out.
        if (lead.status === ResidentLeadStatus.REJECTED) {
            const activeForUnit = await this.db.residentLead.findFirst({
                where: {
                    building: lead.building,
                    floor: lead.floor,
                    flatNumber: lead.flatNumber,
                    status: { not: ResidentLeadStatus.REJECTED },
                    id: { not: lead.id },
                },
                select: { id: true },
            });
            if (activeForUnit)
                throw new ConflictException('residentLead.error.unitReserved');
        }

        const existingUser = await this.db.user.findUnique({
            where: { email: lead.email },
        });

        if (existingUser) {
            await this.updateLeadStatus(lead.id, {
                userId: existingUser.id,
                status: ResidentLeadStatus.CONVERTED,
            });
            await this.recordLead(actor, 'LEAD_APPROVED', lead);
            return { message: 'residentLead.success.alreadyRegistered' };
        }

        // One approve click = one LEAD_APPROVED entry (no INVITATION_SENT).
        await this.invitationsService.create(
            { email: lead.email, role: Role.RESIDENT },
            actor,
            { audit: false }
        );

        await this.updateLeadStatus(lead.id, {
            status: ResidentLeadStatus.INVITED,
        });

        await this.recordLead(actor, 'LEAD_APPROVED', lead);

        return { message: 'residentLead.success.invited' };
    }

    /** Lead status update; a lost unit-reservation race is a 409, not a 500. */
    private async updateLeadStatus(
        id: string,
        data: { status: ResidentLeadStatus; userId?: string }
    ): Promise<void> {
        try {
            await this.db.residentLead.update({ where: { id }, data });
        } catch (error) {
            if (isPrismaError(error, PRISMA_UNIQUE_VIOLATION))
                throw new ConflictException('residentLead.error.unitReserved');
            throw error;
        }
    }

    /**
     * Reject a lead. A CONVERTED lead already has an account and cannot be
     * rejected. Rejecting an INVITED lead also expires its pending RESIDENT
     * invitation, so the emailed link can no longer create the account.
     * Rejecting frees the unit for a new submission (partial unique index).
     */
    async reject(id: string, actor?: IAuthUser): Promise<{ message: string }> {
        const lead = await this.db.residentLead.findUnique({ where: { id } });
        if (!lead) throw new NotFoundException('residentLead.error.notFound');
        if (lead.status === ResidentLeadStatus.CONVERTED)
            throw new ConflictException('residentLead.error.alreadyConverted');
        if (lead.status === ResidentLeadStatus.REJECTED)
            return { message: 'residentLead.success.rejected' };

        await this.db.$transaction(async tx => {
            await tx.residentLead.update({
                where: { id: lead.id },
                data: { status: ResidentLeadStatus.REJECTED },
            });

            if (lead.status !== ResidentLeadStatus.INVITED) return;

            // Another still-invited lead for the same email keeps the link.
            const otherInvited = await tx.residentLead.count({
                where: {
                    email: lead.email,
                    status: ResidentLeadStatus.INVITED,
                    id: { not: lead.id },
                },
            });
            if (otherInvited > 0) return;

            const now = new Date();
            await tx.invitation.updateMany({
                where: {
                    email: lead.email,
                    role: Role.RESIDENT,
                    usedAt: null,
                    expiresAt: { gt: now },
                },
                data: { expiresAt: now },
            });
        });

        await this.recordLead(actor, 'LEAD_REJECTED', lead);

        return { message: 'residentLead.success.rejected' };
    }

    /** Label is name + unit and the email only: never national id, passport or phone. */
    private recordLead(
        actor: IAuthUser | undefined,
        action: 'LEAD_APPROVED' | 'LEAD_REJECTED',
        lead: Pick<
            ResidentLead,
            'id' | 'name' | 'email' | 'building' | 'floor' | 'flatNumber'
        >
    ): Promise<void> {
        return this.audit.record(actor, action, 'ResidentLead', lead.id, {
            label: `${lead.name} — ${lead.building}/${lead.floor}/${lead.flatNumber}`,
            email: lead.email,
        });
    }
}

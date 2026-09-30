import {
    ConflictException,
    Injectable,
    NotFoundException,
} from '@nestjs/common';
import { ResidentLeadStatus, Role } from '@prisma/client';

import { DatabaseService } from 'src/common/database/services/database.service';
import { IAuthUser } from 'src/common/request/interfaces/request.interface';
import { InvitationsService } from 'src/modules/invitations/invitations.service';

import { ResidentLeadCreateDto } from './dtos/request/resident-lead.create.dto';
import { ResidentLeadQueryDto } from './dtos/request/resident-lead.query.dto';
import {
    ResidentLeadListResponseDto,
    ResidentLeadResponseDto,
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
        (existing.parking ?? undefined) === dto.parking
    );
}

@Injectable()
export class ResidentsService {
    constructor(
        private readonly db: DatabaseService,
        private readonly invitationsService: InvitationsService
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
                    status: ResidentLeadStatus.PENDING,
                },
            });
        } catch (error) {
            if (
                typeof error === 'object' &&
                error !== null &&
                'code' in error &&
                error.code === 'P2002'
            ) {
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

        const items = await this.db.residentLead.findMany({
            where: {
                ...(query.status ? { status: query.status } : {}),
            },
            take: limit + 1,
            ...(query.cursor ? { skip: 1, cursor: { id: query.cursor } } : {}),
            orderBy: { createdAt: 'desc' },
        });

        let nextCursor: string | undefined;
        if (items.length > limit) {
            const last = items.pop();
            nextCursor = last?.id;
        }

        return { items, nextCursor };
    }

    /**
     * Invite a lead to register. If a User already exists for the lead's
     * email, we just link + mark CONVERTED — we never create a second
     * invitation or touch the existing account.
     */
    async invite(id: string, actor: IAuthUser): Promise<{ message: string }> {
        const lead = await this.db.residentLead.findUnique({ where: { id } });
        if (!lead) throw new NotFoundException('residentLead.error.notFound');

        const existingUser = await this.db.user.findUnique({
            where: { email: lead.email },
        });

        if (existingUser) {
            await this.db.residentLead.update({
                where: { id: lead.id },
                data: {
                    userId: existingUser.id,
                    status: ResidentLeadStatus.CONVERTED,
                },
            });
            return { message: 'residentLead.success.alreadyRegistered' };
        }

        await this.invitationsService.create(
            { email: lead.email, role: Role.RESIDENT },
            actor
        );

        await this.db.residentLead.update({
            where: { id: lead.id },
            data: { status: ResidentLeadStatus.INVITED },
        });

        return { message: 'residentLead.success.invited' };
    }
}

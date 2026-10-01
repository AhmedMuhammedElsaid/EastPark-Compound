import { ConflictException, NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { ResidentLeadStatus, Role } from '@prisma/client';

import { DatabaseService } from 'src/common/database/services/database.service';
import { InvitationsService } from 'src/modules/invitations/invitations.service';
import { ResidentLeadCreateDto } from 'src/modules/residents/dtos/request/resident-lead.create.dto';
import { ResidentsService } from 'src/modules/residents/residents.service';

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const adminActor = { userId: 'admin-1', role: Role.ADMIN as any };

const validCreateDto = (overrides: Record<string, unknown> = {}) => ({
    name: 'Jane Doe',
    email: 'jane@example.com',
    phone: '01000400163',
    building: 'Building A',
    floor: '3',
    flatNumber: '2',
    parking: 'B-12',
    ...overrides,
});

const mockLead = (overrides: Record<string, unknown> = {}) => ({
    id: 'lead-1',
    name: 'Jane Doe',
    email: 'jane@example.com',
    phone: '01000400163',
    building: 'Building A',
    floor: '3',
    flatNumber: '2',
    parking: 'B-12',
    status: ResidentLeadStatus.PENDING,
    notes: null,
    userId: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
});

// ─── Mocks ────────────────────────────────────────────────────────────────────

const db = {
    residentLead: {
        findFirst: jest.fn(),
        findMany: jest.fn(),
        findUnique: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
    },
    user: {
        findUnique: jest.fn(),
    },
};

const invitationsService = {
    create: jest.fn(),
};

// ─── Test suite ───────────────────────────────────────────────────────────────

describe('ResidentsService', () => {
    let service: ResidentsService;

    beforeEach(async () => {
        jest.clearAllMocks();

        const module: TestingModule = await Test.createTestingModule({
            providers: [
                ResidentsService,
                { provide: DatabaseService, useValue: db },
                { provide: InvitationsService, useValue: invitationsService },
            ],
        }).compile();

        service = module.get(ResidentsService);
    });

    // ── create ────────────────────────────────────────────────────────────────

    describe('create', () => {
        it('creates a new lead at status PENDING when no match exists', async () => {
            db.residentLead.findFirst.mockResolvedValue(null);
            db.residentLead.create.mockResolvedValue(mockLead());

            await service.create(validCreateDto() as ResidentLeadCreateDto);

            expect(db.residentLead.create).toHaveBeenCalledTimes(1);
            const createCall = db.residentLead.create.mock.calls[0]?.[0];
            expect(createCall?.data?.status).toBe(ResidentLeadStatus.PENDING);
        });

        it('normalizes email: lowercased and trimmed', async () => {
            db.residentLead.findFirst.mockResolvedValue(null);
            db.residentLead.create.mockResolvedValue(mockLead());

            await service.create(
                validCreateDto({
                    email: '  ME@Example.COM ',
                }) as ResidentLeadCreateDto
            );

            const createCall = db.residentLead.create.mock.calls[0]?.[0];
            expect(createCall?.data?.email).toBe('me@example.com');
        });

        it('trims name', async () => {
            db.residentLead.findFirst.mockResolvedValue(null);
            db.residentLead.create.mockResolvedValue(mockLead());

            await service.create(
                validCreateDto({
                    name: '  Jane Doe  ',
                }) as ResidentLeadCreateDto
            );

            const createCall = db.residentLead.create.mock.calls[0]?.[0];
            expect(createCall?.data?.name).toBe('Jane Doe');
        });

        it('rejects a submission when the unit already has a non-REJECTED lead', async () => {
            const existing = mockLead({
                id: 'lead-existing',
                email: 'different@example.com',
            });
            db.residentLead.findFirst.mockResolvedValue(existing);

            await expect(
                service.create(validCreateDto() as ResidentLeadCreateDto)
            ).rejects.toBeInstanceOf(ConflictException);

            expect(db.residentLead.create).not.toHaveBeenCalled();
            expect(db.residentLead.update).not.toHaveBeenCalled();
            expect(db.residentLead.findFirst).toHaveBeenCalledWith({
                where: {
                    building: 'Building A',
                    floor: '3',
                    flatNumber: '2',
                    status: { not: ResidentLeadStatus.REJECTED },
                },
            });
        });

        it('returns an existing lead for an exact retry of the same submission', async () => {
            const existing = mockLead({ id: 'lead-existing' });
            db.residentLead.findFirst.mockResolvedValue(existing);

            await expect(
                service.create(validCreateDto() as ResidentLeadCreateDto)
            ).resolves.toBe(existing);

            expect(db.residentLead.create).not.toHaveBeenCalled();
        });

        it('excludes REJECTED leads from the dedupe match (status: { not: REJECTED } in where)', async () => {
            db.residentLead.findFirst.mockResolvedValue(null);
            db.residentLead.create.mockResolvedValue(mockLead());

            await service.create(validCreateDto() as ResidentLeadCreateDto);

            const findFirstCall = db.residentLead.findFirst.mock.calls[0]?.[0];
            expect(findFirstCall?.where?.status).toEqual({
                not: ResidentLeadStatus.REJECTED,
            });
            // A fresh lead is created since findFirst (correctly scoped) found nothing
            expect(db.residentLead.create).toHaveBeenCalledTimes(1);
        });

        it('maps a concurrent unit reservation to the same conflict', async () => {
            db.residentLead.findFirst.mockResolvedValue(null);
            db.residentLead.create.mockRejectedValue({ code: 'P2002' });

            await expect(
                service.create(validCreateDto() as ResidentLeadCreateDto)
            ).rejects.toBeInstanceOf(ConflictException);
        });

        it('returns the winning lead when an identical concurrent retry hits the unique index', async () => {
            const existing = mockLead({ id: 'lead-existing' });
            db.residentLead.findFirst
                .mockResolvedValueOnce(null)
                .mockResolvedValueOnce(existing);
            db.residentLead.create.mockRejectedValue({ code: 'P2002' });

            await expect(
                service.create(validCreateDto() as ResidentLeadCreateDto)
            ).resolves.toBe(existing);
        });
    });

    // ── invite ────────────────────────────────────────────────────────────────

    describe('invite', () => {
        it('throws NotFoundException for an unknown lead id', async () => {
            db.residentLead.findUnique.mockResolvedValue(null);

            await expect(
                service.invite('bad-id', adminActor)
            ).rejects.toBeInstanceOf(NotFoundException);
        });

        it('when a User already exists: links userId, sets CONVERTED, does not create invitation or modify user', async () => {
            const lead = mockLead();
            db.residentLead.findUnique.mockResolvedValue(lead);
            db.user.findUnique.mockResolvedValue({
                id: 'user-1',
                email: lead.email,
            });
            db.residentLead.update.mockResolvedValue(
                mockLead({
                    userId: 'user-1',
                    status: ResidentLeadStatus.CONVERTED,
                })
            );

            await service.invite('lead-1', adminActor);

            expect(invitationsService.create).not.toHaveBeenCalled();
            expect(db.residentLead.update).toHaveBeenCalledWith({
                where: { id: 'lead-1' },
                data: {
                    userId: 'user-1',
                    status: ResidentLeadStatus.CONVERTED,
                },
            });
        });

        it('when no User exists: creates an Invitation with role RESIDENT and sets status INVITED', async () => {
            const lead = mockLead();
            db.residentLead.findUnique.mockResolvedValue(lead);
            db.user.findUnique.mockResolvedValue(null);
            invitationsService.create.mockResolvedValue({});
            db.residentLead.update.mockResolvedValue(
                mockLead({ status: ResidentLeadStatus.INVITED })
            );

            await service.invite('lead-1', adminActor);

            expect(invitationsService.create).toHaveBeenCalledWith(
                { email: lead.email, role: Role.RESIDENT },
                adminActor
            );
            expect(db.residentLead.update).toHaveBeenCalledWith({
                where: { id: 'lead-1' },
                data: { status: ResidentLeadStatus.INVITED },
            });
        });

        it('reconciles the lead when an active invitation already exists', async () => {
            const lead = mockLead();
            db.residentLead.findUnique.mockResolvedValue(lead);
            db.user.findUnique.mockResolvedValue(null);
            invitationsService.create.mockRejectedValue(
                new ConflictException('invitation.error.alreadyPending')
            );

            await expect(
                service.invite('lead-1', adminActor)
            ).resolves.toEqual({ message: 'residentLead.success.invited' });

            expect(db.residentLead.update).toHaveBeenCalledWith({
                where: { id: 'lead-1' },
                data: { status: ResidentLeadStatus.INVITED },
            });
        });

        it('does not mark the lead invited when invitation creation fails', async () => {
            db.residentLead.findUnique.mockResolvedValue(mockLead());
            db.user.findUnique.mockResolvedValue(null);
            invitationsService.create.mockRejectedValue(new Error('email failed'));

            await expect(service.invite('lead-1', adminActor)).rejects.toThrow(
                'email failed'
            );
            expect(db.residentLead.update).not.toHaveBeenCalled();
        });
    });

    // ── findAll ───────────────────────────────────────────────────────────────

    describe('findAll', () => {
        it('cursor pagination: fetches limit+1, pops extra, nextCursor = popped row id', async () => {
            const leads = Array.from({ length: 6 }, (_, i) =>
                mockLead({ id: `lead-${i}` })
            );
            db.residentLead.findMany.mockResolvedValue(leads);

            const result = await service.findAll({ limit: 5 } as any);

            const findManyCall = db.residentLead.findMany.mock.calls[0]?.[0];
            expect(findManyCall?.take).toBe(6);

            expect(result.items).toHaveLength(5);
            expect(result.nextCursor).toBe('lead-5');
        });

        it('returns undefined nextCursor when fewer than limit+1 rows come back', async () => {
            const leads = [
                mockLead({ id: 'lead-0' }),
                mockLead({ id: 'lead-1' }),
            ];
            db.residentLead.findMany.mockResolvedValue(leads);

            const result = await service.findAll({ limit: 20 } as any);

            expect(result.items).toHaveLength(2);
            expect(result.nextCursor).toBeUndefined();
        });

        it('applies the status filter when supplied', async () => {
            db.residentLead.findMany.mockResolvedValue([]);

            await service.findAll({
                limit: 20,
                status: ResidentLeadStatus.PENDING,
            } as any);

            const findManyCall = db.residentLead.findMany.mock.calls[0]?.[0];
            expect(findManyCall?.where).toEqual({
                status: ResidentLeadStatus.PENDING,
            });
        });

        it('omits the status filter when not supplied', async () => {
            db.residentLead.findMany.mockResolvedValue([]);

            await service.findAll({ limit: 20 } as any);

            const findManyCall = db.residentLead.findMany.mock.calls[0]?.[0];
            expect(findManyCall?.where).toEqual({});
        });
    });
});

// ─── DTO validation ─────────────────────────────────────────────────────────────

describe('ResidentLeadCreateDto validation', () => {
    const base = {
        name: 'Jane Doe',
        email: 'jane@example.com',
        phone: '01000400163',
        building: 'Building A',
        floor: '3',
        flatNumber: '2',
    };

    const validateDto = async (overrides: Record<string, unknown>) => {
        const instance = plainToInstance(ResidentLeadCreateDto, {
            ...base,
            ...overrides,
        });
        return validate(instance);
    };

    describe('floor', () => {
        it.each(['G', '1', '11'])('accepts "%s"', async floor => {
            const errors = await validateDto({ floor });
            expect(errors.filter(e => e.property === 'floor')).toHaveLength(0);
        });

        it.each(['0', '12', 'G2', ''])('rejects "%s"', async floor => {
            const errors = await validateDto({ floor });
            expect(
                errors.filter(e => e.property === 'floor').length
            ).toBeGreaterThan(0);
        });

        it('rejects a number (3)', async () => {
            const errors = await validateDto({ floor: 3 });
            expect(
                errors.filter(e => e.property === 'floor').length
            ).toBeGreaterThan(0);
        });
    });

    describe('flatNumber', () => {
        it.each(['1', '2', '3', '4', '5'])('accepts "%s"', async flatNumber => {
            const errors = await validateDto({ flatNumber });
            expect(
                errors.filter(e => e.property === 'flatNumber')
            ).toHaveLength(0);
        });

        it.each(['0', '6', ''])('rejects "%s"', async flatNumber => {
            const errors = await validateDto({ flatNumber });
            expect(
                errors.filter(e => e.property === 'flatNumber').length
            ).toBeGreaterThan(0);
        });
    });

    describe('phone', () => {
        it.each([
            '01000400163',
            '+201000400163',
            '0100 040 0163',
            '0100-040-0163',
        ])('accepts "%s"', async phone => {
            const errors = await validateDto({ phone });
            expect(errors.filter(e => e.property === 'phone')).toHaveLength(0);
        });

        it.each(['12345', '', '+447911123456'])('rejects "%s"', async phone => {
            const errors = await validateDto({ phone });
            expect(
                errors.filter(e => e.property === 'phone').length
            ).toBeGreaterThan(0);
        });
    });

    describe('email', () => {
        it('rejects malformed input', async () => {
            const errors = await validateDto({ email: 'not-an-email' });
            expect(
                errors.filter(e => e.property === 'email').length
            ).toBeGreaterThan(0);
        });
    });

    describe('parking', () => {
        it('is optional — a DTO without it validates cleanly', async () => {
            const instance = plainToInstance(ResidentLeadCreateDto, base);
            const errors = await validate(instance);
            expect(errors).toHaveLength(0);
        });
    });
});

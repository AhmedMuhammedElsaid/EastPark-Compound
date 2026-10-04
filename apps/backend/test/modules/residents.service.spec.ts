import { ConflictException, NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { MaritalStatus, ResidentLeadStatus, Role } from '@prisma/client';

import { DatabaseService } from 'src/common/database/services/database.service';
import { AuditService } from 'src/modules/audit/audit.service';
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
    jobTitle: 'Engineer',
    maritalStatus: MaritalStatus.MARRIED,
    nationalId: '29801011234567',
    passportNumber: 'A12345678',
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
    jobTitle: 'Engineer',
    maritalStatus: MaritalStatus.MARRIED,
    nationalId: '29801011234567',
    passportNumber: 'A12345678',
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
        count: jest.fn(),
        groupBy: jest.fn(),
    },
    user: {
        findUnique: jest.fn(),
    },
    invitation: {
        updateMany: jest.fn(),
    },
    $transaction: jest.fn(),
};

const invitationsService = {
    create: jest.fn(),
};

const audit = { record: jest.fn() };

// ─── Test suite ───────────────────────────────────────────────────────────────

describe('ResidentsService', () => {
    let service: ResidentsService;

    beforeEach(async () => {
        jest.clearAllMocks();

        const module: TestingModule = await Test.createTestingModule({
            providers: [
                ResidentsService,
                { provide: DatabaseService, useValue: db },
                { provide: AuditService, useValue: audit },
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

        it('persists and trims optional personal details', async () => {
            db.residentLead.findFirst.mockResolvedValue(null);
            db.residentLead.create.mockResolvedValue(mockLead());

            await service.create(
                validCreateDto({
                    jobTitle: '  Engineer  ',
                    nationalId: '  29801011234567  ',
                    passportNumber: '  A12345678  ',
                }) as ResidentLeadCreateDto
            );

            const createCall = db.residentLead.create.mock.calls[0]?.[0];
            expect(createCall?.data?.jobTitle).toBe('Engineer');
            expect(createCall?.data?.maritalStatus).toBe(MaritalStatus.MARRIED);
            expect(createCall?.data?.nationalId).toBe('29801011234567');
            expect(createCall?.data?.passportNumber).toBe('A12345678');
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

        it('refuses to re-invite a REJECTED lead whose unit has a newer active lead', async () => {
            db.residentLead.findUnique.mockResolvedValue(
                mockLead({ status: ResidentLeadStatus.REJECTED })
            );
            db.residentLead.findFirst.mockResolvedValue({ id: 'lead-2' });

            await expect(
                service.invite('lead-1', adminActor)
            ).rejects.toBeInstanceOf(ConflictException);
            expect(invitationsService.create).not.toHaveBeenCalled();
            expect(db.residentLead.update).not.toHaveBeenCalled();
        });

        it('maps a lost unit-reservation race on the lead update to 409', async () => {
            db.residentLead.findUnique.mockResolvedValue(mockLead());
            db.user.findUnique.mockResolvedValue(null);
            invitationsService.create.mockResolvedValue({});
            db.residentLead.update.mockRejectedValue({ code: 'P2002' });

            await expect(
                service.invite('lead-1', adminActor)
            ).rejects.toBeInstanceOf(ConflictException);
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

            // The lead approval is the audited action, not the invitation.
            expect(invitationsService.create).toHaveBeenCalledWith(
                { email: lead.email, role: Role.RESIDENT },
                adminActor,
                { audit: false }
            );
            expect(db.residentLead.update).toHaveBeenCalledWith({
                where: { id: 'lead-1' },
                data: { status: ResidentLeadStatus.INVITED },
            });
            expect(audit.record).toHaveBeenCalledTimes(1);
            expect(audit.record).toHaveBeenCalledWith(
                adminActor,
                'LEAD_APPROVED',
                'ResidentLead',
                'lead-1',
                {
                    label: 'Jane Doe — Building A/3/2',
                    email: 'jane@example.com',
                }
            );
        });

        it('marks the lead invited after the invitation service resends an active invitation', async () => {
            const lead = mockLead();
            db.residentLead.findUnique.mockResolvedValue(lead);
            db.user.findUnique.mockResolvedValue(null);
            invitationsService.create.mockResolvedValue({});

            await expect(service.invite('lead-1', adminActor)).resolves.toEqual(
                { message: 'residentLead.success.invited' }
            );

            expect(db.residentLead.update).toHaveBeenCalledWith({
                where: { id: 'lead-1' },
                data: { status: ResidentLeadStatus.INVITED },
            });
        });

        it('does not mark the lead invited when invitation creation fails', async () => {
            db.residentLead.findUnique.mockResolvedValue(mockLead());
            db.user.findUnique.mockResolvedValue(null);
            invitationsService.create.mockRejectedValue(
                new Error('email failed')
            );

            await expect(service.invite('lead-1', adminActor)).rejects.toThrow(
                'email failed'
            );
            expect(db.residentLead.update).not.toHaveBeenCalled();
        });
    });

    // ── reject ────────────────────────────────────────────────────────────────

    describe('reject', () => {
        beforeEach(() => {
            db.$transaction.mockImplementation(
                (fn: (tx: unknown) => unknown) => fn(db)
            );
        });

        it('throws NotFoundException for an unknown lead', async () => {
            db.residentLead.findUnique.mockResolvedValue(null);
            await expect(service.reject('missing')).rejects.toBeInstanceOf(
                NotFoundException
            );
        });

        it('refuses to reject a CONVERTED lead', async () => {
            db.residentLead.findUnique.mockResolvedValue(
                mockLead({ status: ResidentLeadStatus.CONVERTED })
            );
            await expect(service.reject('lead-1')).rejects.toBeInstanceOf(
                ConflictException
            );
            expect(db.residentLead.update).not.toHaveBeenCalled();
        });

        it('is idempotent for an already REJECTED lead', async () => {
            db.residentLead.findUnique.mockResolvedValue(
                mockLead({ status: ResidentLeadStatus.REJECTED })
            );
            const result = await service.reject('lead-1');
            expect(result.message).toBe('residentLead.success.rejected');
            expect(db.residentLead.update).not.toHaveBeenCalled();
        });

        it('audits LEAD_REJECTED with name, unit and email only (no id, passport or phone)', async () => {
            db.residentLead.findUnique.mockResolvedValue(mockLead());
            await service.reject('lead-1', adminActor);
            expect(audit.record).toHaveBeenCalledWith(
                adminActor,
                'LEAD_REJECTED',
                'ResidentLead',
                'lead-1',
                {
                    label: 'Jane Doe — Building A/3/2',
                    email: 'jane@example.com',
                }
            );
            const meta = JSON.stringify(audit.record.mock.calls[0][4]);
            expect(meta).not.toContain('29801011234567');
            expect(meta).not.toContain('A12345678');
            expect(meta).not.toContain('01000400163');
        });

        it('rejects a PENDING lead without touching invitations', async () => {
            db.residentLead.findUnique.mockResolvedValue(mockLead());
            await service.reject('lead-1');
            expect(db.residentLead.update).toHaveBeenCalledWith({
                where: { id: 'lead-1' },
                data: { status: ResidentLeadStatus.REJECTED },
            });
            expect(db.invitation.updateMany).not.toHaveBeenCalled();
        });

        it('expires the pending RESIDENT invitation of an INVITED lead', async () => {
            db.residentLead.findUnique.mockResolvedValue(
                mockLead({ status: ResidentLeadStatus.INVITED })
            );
            db.residentLead.count.mockResolvedValue(0);

            await service.reject('lead-1');

            expect(db.invitation.updateMany).toHaveBeenCalledWith({
                where: expect.objectContaining({
                    email: 'jane@example.com',
                    role: Role.RESIDENT,
                    usedAt: null,
                }),
                data: { expiresAt: expect.any(Date) },
            });
        });
    });

    // ── stats ─────────────────────────────────────────────────────────────────

    describe('stats', () => {
        it('groups all leads by status in one query without a filter', async () => {
            db.residentLead.groupBy.mockResolvedValue([]);

            await service.stats();

            expect(db.residentLead.groupBy).toHaveBeenCalledTimes(1);
            const call = db.residentLead.groupBy.mock.calls[0]?.[0];
            expect(call?.by).toEqual(['status']);
            expect(call?.where).toBeUndefined();
        });

        it('zero-fills missing statuses and sums the total', async () => {
            db.residentLead.groupBy.mockResolvedValue([
                { status: ResidentLeadStatus.PENDING, _count: { _all: 4 } },
                { status: ResidentLeadStatus.REJECTED, _count: { _all: 2 } },
            ]);

            await expect(service.stats()).resolves.toEqual({
                PENDING: 4,
                INVITED: 0,
                CONVERTED: 0,
                REJECTED: 2,
                total: 6,
            });
        });

        it('returns all zeros when there are no leads', async () => {
            db.residentLead.groupBy.mockResolvedValue([]);

            await expect(service.stats()).resolves.toEqual({
                PENDING: 0,
                INVITED: 0,
                CONVERTED: 0,
                REJECTED: 0,
                total: 0,
            });
        });
    });

    // ── findAll ───────────────────────────────────────────────────────────────

    describe('findAll', () => {
        it('cursor pagination: fetches limit+1, drops the extra row, nextCursor = last returned row id', async () => {
            const leads = Array.from({ length: 6 }, (_, i) =>
                mockLead({ id: `lead-${i}` })
            );
            db.residentLead.findMany.mockResolvedValue(leads);

            const result = await service.findAll({ limit: 5 } as any);

            const findManyCall = db.residentLead.findMany.mock.calls[0]?.[0];
            expect(findManyCall?.take).toBe(6);

            expect(result.items).toHaveLength(5);
            expect(result.nextCursor).toBe('lead-4');
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
        it('normalizes to trimmed lower-case before validation', async () => {
            const instance = plainToInstance(ResidentLeadCreateDto, {
                ...base,
                email: '  Jane@Example.COM ',
            });
            expect(instance.email).toBe('jane@example.com');
            const errors = await validate(instance);
            expect(errors.filter(e => e.property === 'email')).toHaveLength(0);
        });

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

    describe('optional personal details', () => {
        it('accepts omitted optional details', async () => {
            const instance = plainToInstance(ResidentLeadCreateDto, base);
            const errors = await validate(instance);
            expect(errors).toHaveLength(0);
        });

        it.each(Object.values(MaritalStatus))(
            'accepts marital status %s',
            async maritalStatus => {
                const errors = await validateDto({ maritalStatus });
                expect(
                    errors.filter(error => error.property === 'maritalStatus')
                ).toHaveLength(0);
            }
        );

        it('rejects an unsupported marital status', async () => {
            const errors = await validateDto({ maritalStatus: 'SEPARATED' });
            expect(
                errors.filter(error => error.property === 'maritalStatus')
                    .length
            ).toBeGreaterThan(0);
        });

        it('accepts a 14-digit national ID', async () => {
            const errors = await validateDto({ nationalId: '29801011234567' });
            expect(errors.filter(error => error.property === 'nationalId')).toHaveLength(0);
        });

        it('rejects a malformed national ID', async () => {
            const errors = await validateDto({ nationalId: '12345' });
            expect(errors.filter(error => error.property === 'nationalId').length).toBeGreaterThan(0);
        });
    });
});

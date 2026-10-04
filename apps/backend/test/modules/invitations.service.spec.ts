import { ForbiddenException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Role } from '@prisma/client';

import { DatabaseService } from 'src/common/database/services/database.service';
import { EmailService } from 'src/common/email/email.service';
import { AuditService } from 'src/modules/audit/audit.service';
import { InvitationsService } from 'src/modules/invitations/invitations.service';

describe('InvitationsService', () => {
    const activeInvitation = {
        id: 'invitation-1',
        email: 'resident@example.com',
        role: Role.RESIDENT,
        token: 'private-token',
        expiresAt: new Date(Date.now() + 60_000),
        usedAt: null,
        createdAt: new Date(),
    };
    const db = {
        invitation: {
            findFirst: jest.fn(),
            create: jest.fn(),
            findMany: jest.fn(),
        },
    };
    const email = { sendInvitation: jest.fn() };
    const config = {
        get: jest.fn((key: string) =>
            key === 'app.webUrl' ? 'https://eastpark-web-app.vercel.app' : undefined
        ),
    };
    const actor = { userId: 'admin-1', role: Role.ADMIN };
    const superAdmin = { userId: 'owner-1', role: Role.SUPER_ADMIN };
    const audit = { record: jest.fn() };
    let service: InvitationsService;

    beforeEach(() => {
        jest.clearAllMocks();
        service = new InvitationsService(
            db as unknown as DatabaseService,
            email as unknown as EmailService,
            config as unknown as ConfigService,
            audit as unknown as AuditService
        );
    });

    it('resends an active invitation without creating a duplicate', async () => {
        db.invitation.findFirst.mockResolvedValue(activeInvitation);
        email.sendInvitation.mockResolvedValue(undefined);

        const result = await service.create(
            { email: activeInvitation.email, role: Role.RESIDENT },
            actor
        );

        expect(db.invitation.create).not.toHaveBeenCalled();
        expect(email.sendInvitation).toHaveBeenCalledWith(
            activeInvitation.email,
            `https://eastpark-web-app.vercel.app/auth/accept-invitation?token=${activeInvitation.token}`,
            Role.RESIDENT
        );
        expect(result).not.toHaveProperty('token');
    });

    it('stores and emails a normalized (trimmed, lower-cased) address', async () => {
        db.invitation.findFirst.mockResolvedValue(null);
        db.invitation.create.mockImplementation(({ data }) =>
            Promise.resolve({ id: 'inv-2', usedAt: null, createdAt: new Date(), ...data })
        );
        email.sendInvitation.mockResolvedValue(undefined);

        const result = await service.create(
            { email: '  Merchant@Example.COM ', role: Role.MERCHANT },
            actor
        );

        expect(db.invitation.findFirst).toHaveBeenCalledWith(
            expect.objectContaining({
                where: expect.objectContaining({ email: 'merchant@example.com' }),
            })
        );
        expect(db.invitation.create).toHaveBeenCalledWith(
            expect.objectContaining({
                data: expect.objectContaining({ email: 'merchant@example.com' }),
            })
        );
        expect(email.sendInvitation.mock.calls[0][0]).toBe('merchant@example.com');
        expect(result.email).toBe('merchant@example.com');
    });

    it('an ADMIN cannot invite an ADMIN (403), not even a resend', async () => {
        const result = service.create(
            { email: 'new-admin@example.com', role: Role.ADMIN },
            actor
        );
        await expect(result).rejects.toBeInstanceOf(ForbiddenException);
        await expect(result).rejects.toThrow(
            'invitation.error.adminInviteRequiresSuperAdmin'
        );
        expect(db.invitation.findFirst).not.toHaveBeenCalled();
        expect(db.invitation.create).not.toHaveBeenCalled();
        expect(email.sendInvitation).not.toHaveBeenCalled();
    });

    it('the SUPER_ADMIN can invite an ADMIN and it is audited', async () => {
        db.invitation.findFirst.mockResolvedValue(null);
        db.invitation.create.mockImplementation(({ data }) =>
            Promise.resolve({ id: 'inv-3', usedAt: null, createdAt: new Date(), ...data })
        );
        email.sendInvitation.mockResolvedValue(undefined);

        await service.create({ email: 'new-admin@example.com', role: Role.ADMIN }, superAdmin);

        expect(audit.record).toHaveBeenCalledWith(superAdmin, 'INVITATION_SENT', 'Invitation', 'inv-3', {
            label: 'new-admin@example.com',
            role: Role.ADMIN,
        });
    });

    it('skips the INVITATION_SENT entry when the caller audits itself', async () => {
        db.invitation.findFirst.mockResolvedValue(activeInvitation);
        email.sendInvitation.mockResolvedValue(undefined);

        await service.create(
            { email: activeInvitation.email, role: Role.RESIDENT },
            actor,
            { audit: false }
        );

        expect(audit.record).not.toHaveBeenCalled();
    });
});

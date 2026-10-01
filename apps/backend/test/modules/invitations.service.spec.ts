import { ConfigService } from '@nestjs/config';
import { Role } from '@prisma/client';

import { DatabaseService } from 'src/common/database/services/database.service';
import { EmailService } from 'src/common/email/email.service';
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
    let service: InvitationsService;

    beforeEach(() => {
        jest.clearAllMocks();
        service = new InvitationsService(
            db as unknown as DatabaseService,
            email as unknown as EmailService,
            config as unknown as ConfigService
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
});
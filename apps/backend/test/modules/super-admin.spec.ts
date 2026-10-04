import { ConfigService } from '@nestjs/config';
import { FeedbackCategory, Role } from '@prisma/client';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';

import { SessionVersionService } from 'src/common/auth/services/session-version.service';
import { DatabaseService } from 'src/common/database/services/database.service';
import { HelperEncryptionService } from 'src/common/helper/services/helper.encryption.service';
import { AuditService } from 'src/modules/audit/audit.service';
import { feedbackLabel } from 'src/modules/feedback/feedback.service';
import { InvitationCreateDto } from 'src/modules/invitations/dtos/request/invitation.create.dto';
import { AdminUserRoleUpdateDto } from 'src/modules/user/dtos/request/user.admin.request';
import { UserService } from 'src/modules/user/services/user.service';

async function errors<T extends object>(
    cls: new () => T,
    payload: Record<string, unknown>
): Promise<number> {
    return (await validate(plainToInstance(cls, payload))).length;
}

describe('no API grants SUPER_ADMIN', () => {
    it('role change accepts RESIDENT, MERCHANT, ADMIN only', async () => {
        for (const role of [Role.RESIDENT, Role.MERCHANT, Role.ADMIN]) {
            expect(await errors(AdminUserRoleUpdateDto, { role })).toBe(0);
        }
        for (const role of [Role.SUPER_ADMIN, Role.GUEST, 'OWNER', undefined]) {
            expect(await errors(AdminUserRoleUpdateDto, { role })).toBe(1);
        }
    });

    it('an invitation can never carry SUPER_ADMIN', async () => {
        const email = 'someone@example.com';
        expect(
            await errors(InvitationCreateDto, { email, role: Role.ADMIN })
        ).toBe(0);
        expect(
            await errors(InvitationCreateDto, { email, role: Role.SUPER_ADMIN })
        ).toBe(1);
    });
});

describe('an audit write failure does not break the request', () => {
    it('changeRole still resolves and revokes sessions when audit_logs rejects', async () => {
        const user = {
            id: 'u1',
            name: 'Sara',
            email: 'sara@example.com',
            role: Role.RESIDENT,
            unitNumber: null,
            createdAt: new Date(),
        };
        const db = {
            user: {
                findUnique: jest.fn().mockResolvedValue(user),
                update: jest
                    .fn()
                    .mockResolvedValue({ ...user, role: Role.MERCHANT }),
            },
            shop: { count: jest.fn().mockResolvedValue(0) },
            auditLog: {
                create: jest.fn().mockRejectedValue(new Error('db down')),
            },
        };
        const sessions = { bump: jest.fn().mockResolvedValue(2) };
        const audit = new AuditService(db as unknown as DatabaseService);
        jest.spyOn(
            (audit as unknown as { logger: { error: () => void } }).logger,
            'error'
        ).mockImplementation(() => undefined);
        const service = new UserService(
            db as unknown as DatabaseService,
            sessions as unknown as SessionVersionService,
            {} as HelperEncryptionService,
            {} as ConfigService,
            audit
        );

        await expect(
            service.changeRole('u1', Role.MERCHANT, {
                userId: 'owner-1',
                role: Role.SUPER_ADMIN,
            })
        ).resolves.toMatchObject({ id: 'u1', role: Role.MERCHANT });
        expect(sessions.bump).toHaveBeenCalledWith('u1');
        expect(db.auditLog.create).toHaveBeenCalledTimes(1);
    });
});

describe('feedback activity label', () => {
    it('is category plus a short ref, never the free-text body', () => {
        const label = feedbackLabel({
            id: 'clxfeedback0abc123',
            category: FeedbackCategory.OTHER,
            body: 'call me on 01000400163, id 29801011234567',
        } as { id: string; category: string });
        expect(label).toBe('OTHER #ABC123');
        expect(label).not.toContain('0100');
    });
});

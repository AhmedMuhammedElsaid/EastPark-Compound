import { ConflictException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { Prisma, Role } from '@prisma/client';

import { DatabaseService } from 'src/common/database/services/database.service';
import { AuditService } from 'src/modules/audit/audit.service';
import { ElectionsService } from 'src/modules/governance/services/elections.service';

const actor = { userId: 'u1', role: Role.RESIDENT };
const admin = { userId: 'a1', role: Role.ADMIN };
const election = (o: Record<string, unknown> = {}) => ({
    id: 'e1',
    title: 't',
    titleAr: 't',
    description: 'd',
    descriptionAr: null,
    expiresAt: new Date(Date.now() + 86400000),
    resultsOpen: false,
    visibilityMode: 'SEALED_UNTIL_DEADLINE',
    createdAt: new Date(),
    candidates: [{ id: 'c1', _count: { votes: 3 } }],
    votes: [],
    ...o,
});
const db = {
    election: { findUnique: jest.fn(), update: jest.fn() },
    electionVote: { findUnique: jest.fn(), create: jest.fn() },
    auditLog: { create: jest.fn() },
};
const audit = { record: jest.fn() };

describe('ElectionsService', () => {
    let svc: ElectionsService;
    beforeEach(async () => {
        jest.clearAllMocks();
        const m = await Test.createTestingModule({
            providers: [
                ElectionsService,
                { provide: DatabaseService, useValue: db },
                { provide: AuditService, useValue: audit },
            ],
        }).compile();
        svc = m.get(ElectionsService);
    });

    it('lazily opens sealed results after expiry', async () => {
        db.election.findUnique.mockResolvedValue(
            election({ expiresAt: new Date(Date.now() - 1000) })
        );
        const r = await svc.findOne('e1', actor);
        expect(r.resultsOpen).toBe(true);
        expect(r.candidates[0]!.voteCount).toBe(3);
    });

    it('keeps ADMIN_CONTROLLED sealed after expiry', async () => {
        db.election.findUnique.mockResolvedValue(
            election({
                expiresAt: new Date(Date.now() - 1000),
                visibilityMode: 'ADMIN_CONTROLLED',
            })
        );
        const r = await svc.findOne('e1', actor);
        expect(r.resultsOpen).toBe(false);
        expect(r.candidates[0]!.voteCount).toBeUndefined();
    });

    it('openResults flips flag and audits', async () => {
        db.election.findUnique.mockResolvedValue(election());
        db.election.update.mockResolvedValue(
            election({ resultsOpen: true, visibilityMode: 'ADMIN_CONTROLLED' })
        );
        const r = await svc.openResults('e1', admin);
        expect(r.resultsOpen).toBe(true);
        expect(db.election.update).toHaveBeenCalledWith(
            expect.objectContaining({ data: { resultsOpen: true } })
        );
        // Recorded through AuditService (after the update), not a raw write.
        expect(db.auditLog.create).not.toHaveBeenCalled();
        expect(audit.record).toHaveBeenCalledWith(
            admin,
            'ELECTION_RESULTS_OPENED',
            'Election',
            'e1',
            { label: 't' }
        );
    });

    it('maps vote P2002 to 409', async () => {
        db.election.findUnique.mockResolvedValue(election());
        db.electionVote.findUnique.mockResolvedValue(null);
        db.electionVote.create.mockRejectedValue(
            new Prisma.PrismaClientKnownRequestError('dup', {
                code: 'P2002',
                clientVersion: 'x',
            })
        );
        await expect(
            svc.vote('e1', { candidateId: 'c1' } as any, actor)
        ).rejects.toBeInstanceOf(ConflictException);
    });
});

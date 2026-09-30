import { ConflictException, NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';

import { DatabaseService } from 'src/common/database/services/database.service';
import { PollsService } from 'src/modules/governance/services/polls.service';

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const actor = { userId: 'user-1', role: 'RESIDENT' as any };

const futureDate = new Date(Date.now() + 7 * 86_400_000); // 7 days ahead
const pastDate = new Date(Date.now() - 1000); // already expired

const mockOption = (id: string) => ({
    id,
    label: 'Yes',
    labelAr: 'نعم',
    _count: { votes: 5 },
});

const mockPoll = (overrides: Record<string, unknown> = {}) => ({
    id: 'poll-1',
    question: 'Should we add a gym?',
    questionAr: 'هل نضيف صالة رياضية؟',
    expiresAt: futureDate,
    createdAt: new Date(),
    options: [mockOption('opt-1'), mockOption('opt-2')],
    votes: [],
    ...overrides,
});

// ─── Mocks ────────────────────────────────────────────────────────────────────

const db = {
    poll: {
        create: jest.fn(),
        findMany: jest.fn(),
        findUnique: jest.fn(),
    },
    vote: {
        findUnique: jest.fn(),
        create: jest.fn(),
    },
};

// ─── Test suite ───────────────────────────────────────────────────────────────

describe('PollsService', () => {
    let service: PollsService;

    beforeEach(async () => {
        jest.clearAllMocks();

        const module: TestingModule = await Test.createTestingModule({
            providers: [
                PollsService,
                { provide: DatabaseService, useValue: db },
            ],
        }).compile();

        service = module.get(PollsService);
    });

    // ── findAll ───────────────────────────────────────────────────────────────

    describe('findAll', () => {
        it('returns paginated items without nextCursor when under limit', async () => {
            const polls = [mockPoll(), mockPoll({ id: 'poll-2' })];
            db.poll.findMany.mockResolvedValue(polls);

            const result = await service.findAll({ limit: 20 }, actor);

            expect(result.items).toHaveLength(2);
            expect(result.nextCursor).toBeUndefined();
        });

        it('returns nextCursor when result length exceeds limit', async () => {
            // Return limit+1 to trigger cursor pagination
            const polls = Array.from({ length: 6 }, (_, i) =>
                mockPoll({ id: `poll-${i}` })
            );
            db.poll.findMany.mockResolvedValue(polls);

            const result = await service.findAll({ limit: 5 }, actor);

            expect(result.items).toHaveLength(5);
            expect(result.nextCursor).toBe('poll-5');
        });

        it('hides vote counts on active (non-expired) polls', async () => {
            db.poll.findMany.mockResolvedValue([mockPoll()]); // futureDate

            const result = await service.findAll({ limit: 20 }, actor);

            const opt = result.items[0]?.options[0];
            expect(opt).not.toHaveProperty('voteCount');
        });

        it('exposes vote counts after poll expires', async () => {
            db.poll.findMany.mockResolvedValue([
                mockPoll({ expiresAt: pastDate }),
            ]);

            const result = await service.findAll({ limit: 20 }, actor);

            const opt = result.items[0]?.options[0];
            expect(opt).toHaveProperty('voteCount', 5);
        });

        it('sets myVoteOptionId from actor vote', async () => {
            const poll = mockPoll({
                votes: [{ optionId: 'opt-1' }],
            });
            db.poll.findMany.mockResolvedValue([poll]);

            const result = await service.findAll({ limit: 20 }, actor);

            expect(result.items[0]?.myVoteOptionId).toBe('opt-1');
        });
    });

    // ── findOne ───────────────────────────────────────────────────────────────

    describe('findOne', () => {
        it('throws NotFoundException when poll does not exist', async () => {
            db.poll.findUnique.mockResolvedValue(null);
            await expect(
                service.findOne('bad-id', actor)
            ).rejects.toBeInstanceOf(NotFoundException);
        });

        it('returns poll without vote counts when not expired', async () => {
            db.poll.findUnique.mockResolvedValue(mockPoll());

            const result = await service.findOne('poll-1', actor);

            expect(result.options[0]).not.toHaveProperty('voteCount');
        });

        it('returns poll with vote counts when expired', async () => {
            db.poll.findUnique.mockResolvedValue(
                mockPoll({ expiresAt: pastDate })
            );

            const result = await service.findOne('poll-1', actor);

            expect(result.options[0]).toHaveProperty('voteCount');
        });
    });

    // ── vote ──────────────────────────────────────────────────────────────────

    describe('vote', () => {
        it('throws NotFoundException when poll does not exist', async () => {
            db.poll.findUnique.mockResolvedValue(null);
            await expect(
                service.vote('bad-poll', { optionId: 'opt-1' }, actor)
            ).rejects.toBeInstanceOf(NotFoundException);
        });

        it('throws NotFoundException when optionId does not belong to poll', async () => {
            db.poll.findUnique.mockResolvedValue(
                mockPoll({ options: [{ id: 'opt-1' }] })
            );
            await expect(
                service.vote('poll-1', { optionId: 'opt-999' }, actor)
            ).rejects.toBeInstanceOf(NotFoundException);
        });

        it('throws ConflictException when user has already voted', async () => {
            db.poll.findUnique.mockResolvedValue(
                mockPoll({ options: [{ id: 'opt-1' }] })
            );
            db.vote.findUnique.mockResolvedValue({
                userId: 'user-1',
                pollId: 'poll-1',
            });

            await expect(
                service.vote('poll-1', { optionId: 'opt-1' }, actor)
            ).rejects.toBeInstanceOf(ConflictException);
        });

        it('creates vote and returns success message on first vote', async () => {
            db.poll.findUnique.mockResolvedValue(
                mockPoll({ options: [{ id: 'opt-1' }] })
            );
            db.vote.findUnique.mockResolvedValue(null);
            db.vote.create.mockResolvedValue({});

            const result = await service.vote(
                'poll-1',
                { optionId: 'opt-1' },
                actor
            );

            expect(db.vote.create).toHaveBeenCalledTimes(1);
            expect(result.message).toBeDefined();
        });
    });
});

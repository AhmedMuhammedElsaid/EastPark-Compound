import { FeedbackCategory } from '@prisma/client';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';

import { FeedbackCreateDto } from 'src/modules/feedback/dtos/request/feedback.create.dto';
import { FeedbackReplyDto } from 'src/modules/feedback/dtos/request/feedback.reply.dto';
import { ReviewCreateDto } from 'src/modules/shops/dtos/request/review.create.dto';

async function errors<T extends object>(
    cls: new () => T,
    payload: Record<string, unknown>
): Promise<number> {
    return (await validate(plainToInstance(cls, payload))).length;
}

describe('free-text length caps (match the web/mobile form limits)', () => {
    const feedback = { category: FeedbackCategory.OTHER };

    it('feedback body: 4000 chars ok, 4001 rejected', async () => {
        expect(
            await errors(FeedbackCreateDto, { ...feedback, body: 'a'.repeat(4000) })
        ).toBe(0);
        expect(
            await errors(FeedbackCreateDto, { ...feedback, body: 'a'.repeat(4001) })
        ).toBe(1);
    });

    it('feedback reply body: 5000 chars ok (web admin limit), 5001 rejected', async () => {
        expect(await errors(FeedbackReplyDto, { body: 'a'.repeat(5000) })).toBe(0);
        expect(await errors(FeedbackReplyDto, { body: 'a'.repeat(5001) })).toBe(1);
    });

    it('review comment: 1000 chars ok, 1001 rejected', async () => {
        expect(
            await errors(ReviewCreateDto, { rating: 5, comment: 'a'.repeat(1000) })
        ).toBe(0);
        expect(
            await errors(ReviewCreateDto, { rating: 5, comment: 'a'.repeat(1001) })
        ).toBe(1);
    });
});

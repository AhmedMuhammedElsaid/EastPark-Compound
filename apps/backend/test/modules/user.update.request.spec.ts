import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';

import { UserUpdateDto } from '../../src/modules/user/dtos/request/user.update.request';

async function validateDto(payload: Record<string, unknown>) {
    return validate(plainToInstance(UserUpdateDto, payload));
}

describe('UserUpdateDto', () => {
    it('accepts an empty partial update', async () => {
        await expect(validateDto({})).resolves.toHaveLength(0);
    });

    it('accepts null for nullable profile fields', async () => {
        await expect(
            validateDto({ phone: null, unitNumber: null, avatarUrl: null })
        ).resolves.toHaveLength(0);
    });

    it('accepts valid profile values and trims the name', async () => {
        const dto = plainToInstance(UserUpdateDto, {
            name: '  Ahmed Hassan  ',
            phone: '+201234567890',
            unitNumber: 'B2-405',
            avatarUrl: 'https://storage.example.com/avatars/user.jpg',
        });

        await expect(validate(dto)).resolves.toHaveLength(0);
        expect(dto.name).toBe('Ahmed Hassan');
    });

    it.each([
        ['phone', { phone: 'not-a-phone' }],
        ['unitNumber', { unitNumber: 405 }],
        ['avatarUrl', { avatarUrl: 'not-a-url' }],
    ])('rejects an invalid %s', async (property, payload) => {
        const errors = await validateDto(payload);
        expect(errors.some(error => error.property === property)).toBe(true);
    });
});
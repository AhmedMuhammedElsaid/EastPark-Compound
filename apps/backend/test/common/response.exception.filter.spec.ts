import {
    ArgumentsHost,
    BadRequestException,
    ConflictException,
    NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import { MessageService } from 'src/common/message/services/message.service';
import {
    errorCodeOf,
    ResponseExceptionFilter,
} from 'src/common/response/filters/response.exception.filter';

function run(exception: unknown): Record<string, unknown> {
    const send = jest.fn();
    const reply = { code: jest.fn().mockReturnValue({ send }) };
    const host = {
        switchToHttp: () => ({
            getResponse: () => reply,
            getRequest: () => ({ method: 'POST', url: '/v1/x' }),
        }),
    } as unknown as ArgumentsHost;
    const config = {
        get: () => 'production',
    } as unknown as ConfigService;
    new ResponseExceptionFilter(new MessageService(), config).catch(
        exception,
        host
    );
    return send.mock.calls[0][0] as Record<string, unknown>;
}

describe('ResponseExceptionFilter error code', () => {
    it('carries the message key as a stable code (409 accountDeleted)', () => {
        const body = run(new ConflictException('user.error.accountDeleted'));
        expect(body).toMatchObject({
            statusCode: 409,
            code: 'user.error.accountDeleted',
        });
        expect(typeof body.message).toBe('string');
    });

    it('carries the code for a single-message 400 too', () => {
        expect(run(new BadRequestException('order.error.empty')).code).toBe(
            'order.error.empty'
        );
    });

    it('has no code for prose messages, validation arrays or non-HTTP errors', () => {
        expect(
            run(new ConflictException('An account with this email already exists'))
        ).not.toHaveProperty('code');
        expect(run(new NotFoundException())).not.toHaveProperty('code');
        expect(
            run(new BadRequestException(['email must be an email']))
        ).not.toHaveProperty('code');
        expect(run(new Error('user.error.boom'))).not.toHaveProperty('code');
    });

    it('errorCodeOf accepts dotted keys only', () => {
        expect(errorCodeOf('trash.error.parentDeleted')).toBe(
            'trash.error.parentDeleted'
        );
        expect(errorCodeOf('Invitation expired')).toBeUndefined();
        expect(errorCodeOf('ThrottlerException: Too Many Requests')).toBeUndefined();
        expect(errorCodeOf('Cannot GET /v1/x')).toBeUndefined();
        expect(errorCodeOf('user')).toBeUndefined();
        expect(errorCodeOf(undefined)).toBeUndefined();
    });
});

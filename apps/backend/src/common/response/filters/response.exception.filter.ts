import {
    ArgumentsHost,
    BadRequestException,
    Catch,
    ExceptionFilter,
    HttpException,
    HttpStatus,
    Logger,
} from '@nestjs/common';
import { FastifyReply, FastifyRequest } from 'fastify';

import { MessageService } from 'src/common/message/services/message.service';

import { IApiErrorResponse } from '../interfaces/response.interface';

@Catch()
export class ResponseExceptionFilter implements ExceptionFilter {
    private readonly logger = new Logger(ResponseExceptionFilter.name);

    constructor(private readonly messageService: MessageService) {}

    catch(exception: unknown, host: ArgumentsHost): void {
        const ctx = host.switchToHttp();
        const response = ctx.getResponse<FastifyReply>();
        const request = ctx.getRequest<FastifyRequest>();

        const statusCode =
            exception instanceof HttpException
                ? exception.getStatus()
                : HttpStatus.INTERNAL_SERVER_ERROR;

        let message: string;
        let validationMessages: string[] | undefined;

        if (exception instanceof BadRequestException) {
            const exceptionResponse = exception.getResponse() as {
                message?: string | string[];
            };
            const exceptionMessage = exceptionResponse.message;

            if (Array.isArray(exceptionMessage)) {
                validationMessages = exceptionMessage.map(msg =>
                    this.messageService.translate(msg, { defaultValue: msg })
                );
                message = this.messageService.translateKey(
                    ['http', 'error', statusCode],
                    {
                        defaultValue: 'Bad Request',
                    }
                );
            } else {
                message = this.messageService.translate(
                    exceptionMessage ?? 'http.error.400',
                    {
                        defaultValue: exceptionMessage ?? 'Bad Request',
                    }
                );
            }
        } else if (exception instanceof HttpException) {
            message = this.messageService.translate(exception.message, {
                defaultValue: exception.message,
            });
        } else {
            message = this.messageService.translateKey(
                ['http', 'error', statusCode],
                {
                    defaultValue: 'Internal Server Error',
                }
            );
        }

        const errorResponse: IApiErrorResponse = {
            statusCode,
            message,
            timestamp: new Date().toISOString(),
        };

        if (statusCode >= HttpStatus.INTERNAL_SERVER_ERROR) {
            this.logger.error(
                `${request.method} ${request.url} - ${statusCode}: ${message}`,
                exception instanceof Error ? exception.stack : undefined
            );
        } else if (statusCode >= HttpStatus.BAD_REQUEST) {
            this.logger.warn(
                `${request.method} ${request.url} - ${statusCode}: ${message}`
            );
        }

        if (validationMessages) {
            errorResponse.error = validationMessages;
        } else if (exception instanceof Error) {
            errorResponse.error = exception.stack;
        }

        void response.code(statusCode).send(errorResponse);
    }
}

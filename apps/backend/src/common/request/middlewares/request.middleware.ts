import { Injectable, Logger, NestMiddleware } from '@nestjs/common';
import { FastifyRequest, FastifyReply } from 'fastify';

@Injectable()
export class RequestLoggerMiddleware implements NestMiddleware {
    private readonly logger = new Logger('HTTP');

    use(
        req: FastifyRequest['raw'],
        res: FastifyReply['raw'],
        next: () => void
    ): void {
        const method = req.method ?? '';
        const url = req.url ?? '';
        const start = Date.now();

        res.on('finish', () => {
            const ms = Date.now() - start;
            this.logger.log(`${method} ${url} ${res.statusCode} +${ms}ms`);
        });

        next();
    }
}

import { MiddlewareConsumer, Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';

import { JwtAccessGuard } from './guards/jwt.access.guard';
import { RolesGuard } from './guards/roles.guard';
import { RequestLoggerMiddleware } from './middlewares/request.middleware';

@Module({
    imports: [
        ThrottlerModule.forRootAsync({
            imports: [ConfigModule],
            useFactory: (configService: ConfigService) => ({
                throttlers: [
                    {
                        // @nestjs/throttler v6 uses milliseconds — multiply config seconds by 1000
                        ttl:
                            (configService.get<number>('app.throttle.ttl') ??
                                60) * 1000,
                        limit:
                            configService.get<number>('app.throttle.limit') ??
                            100,
                    },
                ],
            }),
            inject: [ConfigService],
        }),
    ],
    providers: [
        { provide: APP_GUARD, useClass: ThrottlerGuard },
        { provide: APP_GUARD, useClass: JwtAccessGuard },
        { provide: APP_GUARD, useClass: RolesGuard },
    ],
})
export class RequestModule {
    configure(consumer: MiddlewareConsumer): void {
        consumer.apply(RequestLoggerMiddleware).forRoutes('*');
    }
}

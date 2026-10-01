import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';

import { CacheClient } from './clients/cache-client.interface';
import { IoredisCacheClient } from './clients/ioredis-cache.client';
import { UpstashCacheClient } from './clients/upstash-cache.client';
import { REDIS_CLIENT } from './constants/cache.constant';
import { CacheService } from './services/cache.service';

@Module({
    imports: [ConfigModule],
    providers: [
        {
            provide: REDIS_CLIENT,
            inject: [ConfigService],
            useFactory: (configService: ConfigService): CacheClient => {
                const restUrl = configService.get<string>('redis.restUrl');
                const restToken = configService.get<string>('redis.restToken');
                if (restUrl && restToken) {
                    return new UpstashCacheClient(restUrl, restToken);
                }
                return new IoredisCacheClient(
                    configService.getOrThrow<string>('redis.url')
                );
            },
        },
        CacheService,
    ],
    exports: [CacheService],
})
export class CacheModule {}

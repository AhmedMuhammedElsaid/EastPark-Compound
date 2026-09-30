import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';

import { AuthModule } from './auth/auth.module';
import { CacheModule } from './cache/cache.module';
import configs from './config';
import { DatabaseModule } from './database/database.module';
import { EmailModule } from './email/email.module';
import { FileModule } from './file/file.module';
import { CustomLoggerModule } from './logger/logger.module';
import { RequestModule } from './request/request.module';
import { ResponseModule } from './response/response.module';

@Module({
    imports: [
        // Configuration — global, loaded once
        ConfigModule.forRoot({
            load: configs,
            isGlobal: true,
            cache: true,
            envFilePath: ['.env'],
            expandVariables: true,
        }),

        // Core Infrastructure
        DatabaseModule,
        AuthModule,
        FileModule,
        EmailModule,

        // Cross-cutting Concerns
        CustomLoggerModule,
        RequestModule,
        ResponseModule,
        CacheModule,
    ],
    exports: [DatabaseModule, CacheModule, EmailModule],
})
export class CommonModule {}

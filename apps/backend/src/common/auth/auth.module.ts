import { Module } from '@nestjs/common';
import { PassportModule } from '@nestjs/passport';

import { CacheModule } from '../cache/cache.module';
import { DatabaseModule } from '../database/database.module';
import { EmailModule } from '../email/email.module';
import { HelperModule } from '../helper/helper.module';

import { AuthPublicController } from './controllers/auth.public.controller';
import { JwtAccessStrategy } from './providers/access-jwt.strategy';
import { JwtRefreshStrategy } from './providers/refresh-jwt.strategy';
import { AuthService } from './services/auth.service';

@Module({
    controllers: [AuthPublicController],
    imports: [
        HelperModule,
        PassportModule,
        DatabaseModule,
        CacheModule,
        EmailModule,
    ],
    providers: [AuthService, JwtAccessStrategy, JwtRefreshStrategy],
    exports: [AuthService, JwtAccessStrategy, JwtRefreshStrategy],
})
export class AuthModule {}

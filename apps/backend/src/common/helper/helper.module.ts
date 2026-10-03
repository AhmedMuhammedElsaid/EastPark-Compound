import { Module } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';

import { HelperEncryptionService } from './services/helper.encryption.service';

@Module({
    providers: [JwtService, HelperEncryptionService],
    exports: [HelperEncryptionService],
})
export class HelperModule {}

import { Module } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';

import { HelperEncryptionService } from './services/helper.encryption.service';
import { HelperPaginationService } from './services/helper.pagination.service';
import { HelperPrismaQueryBuilderService } from './services/helper.query.builder.service';
import { HelperQueryService } from './services/helper.query.service';

@Module({
    providers: [
        JwtService,
        HelperEncryptionService,
        HelperPaginationService,
        HelperPrismaQueryBuilderService,
        HelperQueryService,
    ],
    exports: [
        HelperEncryptionService,
        HelperPaginationService,
        HelperPrismaQueryBuilderService,
        HelperQueryService,
    ],
})
export class HelperModule {}

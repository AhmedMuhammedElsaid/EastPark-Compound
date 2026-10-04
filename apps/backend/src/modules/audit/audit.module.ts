import { Global, Module } from '@nestjs/common';

import { DatabaseModule } from 'src/common/database/database.module';

import { AuditAdminController } from './audit.admin.controller';
import { AuditService } from './audit.service';

/** Global so every feature service can inject AuditService directly. */
@Global()
@Module({
    imports: [DatabaseModule],
    controllers: [AuditAdminController],
    providers: [AuditService],
    exports: [AuditService],
})
export class AuditModule {}

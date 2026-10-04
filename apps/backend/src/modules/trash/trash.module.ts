import { Module } from '@nestjs/common';

import { DatabaseModule } from 'src/common/database/database.module';

import { TrashAdminController } from './trash.admin.controller';
import { TrashService } from './trash.service';

/** Recycle bin: list and restore soft-deleted records (SUPER_ADMIN only). */
@Module({
    imports: [DatabaseModule],
    controllers: [TrashAdminController],
    providers: [TrashService],
})
export class TrashModule {}

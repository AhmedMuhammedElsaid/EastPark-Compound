import { Module } from '@nestjs/common';

import { CacheModule } from 'src/common/cache/cache.module';
import { DatabaseModule } from 'src/common/database/database.module';

import { PaymentsInitiateController } from './payments-initiate.controller';
import { PaymentsController } from './payments.controller';
import { PaymentsService } from './payments.service';

@Module({
    imports: [DatabaseModule, CacheModule],
    controllers: [PaymentsController, PaymentsInitiateController],
    providers: [PaymentsService],
    exports: [PaymentsService],
})
export class PaymentsModule {}

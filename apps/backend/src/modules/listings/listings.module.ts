import { Module } from '@nestjs/common';
import { FlatOwnershipModule } from 'src/common/finance/flat-ownership.module';

import { CacheModule } from 'src/common/cache/cache.module';
import { DatabaseModule } from 'src/common/database/database.module';
import { NotificationsModule } from 'src/modules/notifications/notifications.module';
import { ResidentUnitsModule } from 'src/modules/units/resident-units.module';

import { ListingNotifier } from './listing.notifier';
import { ListingsAdminController } from './listings.admin.controller';
import { ListingsAdminService } from './listings.admin.service';
import { ListingsController } from './listings.controller';
import { ListingsService } from './listings.service';

@Module({
    imports: [
        DatabaseModule,
        CacheModule,
        NotificationsModule,
        ResidentUnitsModule,
        FlatOwnershipModule,
    ],
    controllers: [ListingsController, ListingsAdminController],
    providers: [ListingsService, ListingsAdminService, ListingNotifier],
})
export class ListingsModule {}

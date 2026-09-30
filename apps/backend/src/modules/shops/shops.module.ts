import { Module } from '@nestjs/common';

import { DatabaseModule } from 'src/common/database/database.module';

import { ReviewsController } from './reviews.controller';
import { ReviewsService } from './reviews.service';
import { SavedShopsController } from './saved-shops.controller';
import { SavedShopsService } from './saved-shops.service';
import { ShopsController } from './shops.controller';
import { ShopsService } from './shops.service';

@Module({
    imports: [DatabaseModule],
    controllers: [ShopsController, ReviewsController, SavedShopsController],
    providers: [ShopsService, ReviewsService, SavedShopsService],
    exports: [ShopsService, SavedShopsService],
})
export class ShopsModule {}

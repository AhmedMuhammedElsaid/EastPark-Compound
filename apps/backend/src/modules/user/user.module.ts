import { Module } from '@nestjs/common';

import { DatabaseModule } from 'src/common/database/database.module';
import { HelperModule } from 'src/common/helper/helper.module';
import { ShopsModule } from 'src/modules/shops/shops.module';

import { UserAdminController } from './controllers/user.admin.controller';
import { UserPublicController } from './controllers/user.public.controller';
import { UserSavedShopsController } from './controllers/user.saved-shops.controller';
import { UserService } from './services/user.service';

@Module({
    imports: [HelperModule, DatabaseModule, ShopsModule],
    controllers: [UserAdminController, UserPublicController, UserSavedShopsController],
    providers: [UserService],
    exports: [UserService],
})
export class UserModule {}

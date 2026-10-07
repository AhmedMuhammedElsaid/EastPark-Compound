import { Module } from '@nestjs/common';

import { AuthModule } from 'src/common/auth/auth.module';
import { DatabaseModule } from 'src/common/database/database.module';
import { HelperModule } from 'src/common/helper/helper.module';
import { ShopsModule } from 'src/modules/shops/shops.module';
import { ResidentUnitsModule } from 'src/modules/units/resident-units.module';

import { UserAdminController } from './controllers/user.admin.controller';
import { UserPublicController } from './controllers/user.public.controller';
import { UserSavedShopsController } from './controllers/user.saved-shops.controller';
import { UserService } from './services/user.service';

@Module({
    imports: [
        AuthModule,
        HelperModule,
        DatabaseModule,
        ShopsModule,
        ResidentUnitsModule,
    ],
    controllers: [
        UserAdminController,
        UserPublicController,
        UserSavedShopsController,
    ],
    providers: [UserService],
    exports: [UserService],
})
export class UserModule {}

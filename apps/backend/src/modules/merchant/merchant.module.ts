import { Module } from '@nestjs/common';

import { DatabaseModule } from 'src/common/database/database.module';
import { OrdersModule } from 'src/modules/orders/orders.module';
import { ProductsModule } from 'src/modules/products/products.module';
import { ShopsModule } from 'src/modules/shops/shops.module';

import { MerchantController } from './merchant.controller';
import { MerchantService } from './merchant.service';

@Module({
    imports: [DatabaseModule, ShopsModule, ProductsModule, OrdersModule],
    controllers: [MerchantController],
    providers: [MerchantService],
})
export class MerchantModule {}

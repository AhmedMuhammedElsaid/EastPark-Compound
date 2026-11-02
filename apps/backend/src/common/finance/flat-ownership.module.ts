import { Module } from '@nestjs/common';

import { FlatOwnershipService } from './flat-ownership.service';

/** Ownership-period writers (accounting slice 5); ConfigModule is global. */
@Module({
    providers: [FlatOwnershipService],
    exports: [FlatOwnershipService],
})
export class FlatOwnershipModule {}

import { Module } from '@nestjs/common';

import { DatabaseModule } from 'src/common/database/database.module';
import { EmailModule } from 'src/common/email/email.module';

import { ResidentUnitsService } from './resident-units.service';

@Module({
    imports: [DatabaseModule, EmailModule],
    providers: [ResidentUnitsService],
    exports: [ResidentUnitsService],
})
export class ResidentUnitsModule {}

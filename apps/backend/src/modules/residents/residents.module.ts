import { Module } from '@nestjs/common';

import { DatabaseModule } from 'src/common/database/database.module';
import { InvitationsModule } from 'src/modules/invitations/invitations.module';
import { ResidentUnitsModule } from 'src/modules/units/resident-units.module';

import { ResidentsAdminController } from './residents.admin.controller';
import { ResidentsController } from './residents.controller';
import { ResidentsService } from './residents.service';

@Module({
    imports: [DatabaseModule, InvitationsModule, ResidentUnitsModule],
    controllers: [ResidentsController, ResidentsAdminController],
    providers: [ResidentsService],
})
export class ResidentsModule {}

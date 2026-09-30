import { Module } from '@nestjs/common';

import { DatabaseModule } from 'src/common/database/database.module';
import { InvitationsModule } from 'src/modules/invitations/invitations.module';

import { ResidentsAdminController } from './residents.admin.controller';
import { ResidentsController } from './residents.controller';
import { ResidentsService } from './residents.service';

@Module({
    imports: [DatabaseModule, InvitationsModule],
    controllers: [ResidentsController, ResidentsAdminController],
    providers: [ResidentsService],
})
export class ResidentsModule {}

import { Module } from '@nestjs/common';

import { DatabaseModule } from 'src/common/database/database.module';
import { EmailModule } from 'src/common/email/email.module';

import { InvitationsController } from './invitations.controller';
import { InvitationsService } from './invitations.service';

@Module({
    imports: [DatabaseModule, EmailModule],
    controllers: [InvitationsController],
    providers: [InvitationsService],
    exports: [InvitationsService],
})
export class InvitationsModule {}

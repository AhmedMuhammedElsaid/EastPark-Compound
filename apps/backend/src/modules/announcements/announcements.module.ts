import { Module } from '@nestjs/common';

import { DatabaseModule } from 'src/common/database/database.module';

import { AnnouncementsController } from './announcements.controller';
import { AnnouncementsService } from './announcements.service';

@Module({
    imports: [DatabaseModule],
    controllers: [AnnouncementsController],
    providers: [AnnouncementsService],
})
export class AnnouncementsModule {}

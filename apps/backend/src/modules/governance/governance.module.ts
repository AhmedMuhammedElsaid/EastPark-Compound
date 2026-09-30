import { Module } from '@nestjs/common';

import { DatabaseModule } from 'src/common/database/database.module';

import { ElectionsController } from './controllers/elections.controller';
import { PollsController } from './controllers/polls.controller';
import { ElectionsService } from './services/elections.service';
import { PollsService } from './services/polls.service';

@Module({
    imports: [DatabaseModule],
    controllers: [PollsController, ElectionsController],
    providers: [PollsService, ElectionsService],
})
export class GovernanceModule {}

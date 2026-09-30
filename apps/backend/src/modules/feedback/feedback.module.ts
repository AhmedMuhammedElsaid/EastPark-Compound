import { Module } from '@nestjs/common';

import { DatabaseModule } from 'src/common/database/database.module';

import { FeedbackController } from './feedback.controller';
import { FeedbackService } from './feedback.service';

@Module({
    imports: [DatabaseModule],
    controllers: [FeedbackController],
    providers: [FeedbackService],
})
export class FeedbackModule {}

import { Module } from '@nestjs/common';

import { EmailModule } from 'src/common/email/email.module';

import { SupportController } from './support.controller';
import { SupportService } from './support.service';

@Module({
    imports: [EmailModule],
    controllers: [SupportController],
    providers: [SupportService],
})
export class SupportModule {}
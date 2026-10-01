import { Test, TestingModule } from '@nestjs/testing';

import { EmailService } from 'src/common/email/email.service';
import {
    SupportIssueCategory,
    SupportIssueCreateDto,
} from 'src/modules/support/dtos/request/support-issue.create.dto';
import { SupportService } from 'src/modules/support/support.service';

describe('SupportService', () => {
    const email = { sendSupportIssue: jest.fn() };
    let service: SupportService;

    beforeEach(async () => {
        jest.clearAllMocks();
        const module: TestingModule = await Test.createTestingModule({
            providers: [
                SupportService,
                { provide: EmailService, useValue: email },
            ],
        }).compile();
        service = module.get(SupportService);
    });

    it('normalizes the sender and delivers the complete issue', async () => {
        const dto: SupportIssueCreateDto = {
            name: '  Ahmed Hassan  ',
            email: '  AHMED@EXAMPLE.COM ',
            category: SupportIssueCategory.BUG,
            subject: '  Orders page is empty  ',
            message: '  My orders do not appear after signing in.  ',
            pageUrl: 'https://eastpark-web-app.vercel.app/orders',
        };

        await service.createIssue(dto);

        expect(email.sendSupportIssue).toHaveBeenCalledWith({
            name: 'Ahmed Hassan',
            email: 'ahmed@example.com',
            category: 'BUG',
            subject: 'Orders page is empty',
            message: 'My orders do not appear after signing in.',
            pageUrl: dto.pageUrl,
        });
    });
});
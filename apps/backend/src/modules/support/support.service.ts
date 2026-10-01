import { Injectable } from '@nestjs/common';

import { EmailService } from 'src/common/email/email.service';

import { SupportIssueCreateDto } from './dtos/request/support-issue.create.dto';

@Injectable()
export class SupportService {
    constructor(private readonly email: EmailService) {}

    async createIssue(dto: SupportIssueCreateDto): Promise<void> {
        await this.email.sendSupportIssue({
            name: dto.name.trim(),
            email: dto.email.trim().toLowerCase(),
            category: dto.category,
            subject: dto.subject.trim(),
            message: dto.message.trim(),
            ...(dto.pageUrl ? { pageUrl: dto.pageUrl } : {}),
        });
    }
}
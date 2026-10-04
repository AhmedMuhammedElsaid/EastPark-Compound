import { Injectable, NotFoundException } from '@nestjs/common';

import { DatabaseService } from 'src/common/database/services/database.service';
import { cursorArgs, toCursorPage } from 'src/common/helper/pagination';
import { IAuthUser } from 'src/common/request/interfaces/request.interface';
import { AuditService } from 'src/modules/audit/audit.service';

import { ReportCreateDto } from './dtos/request/report.create.dto';
import { ReportQueryDto } from './dtos/request/report.query.dto';
import {
    ReportListResponseDto,
    ReportResponseDto,
} from './dtos/response/report.response.dto';

@Injectable()
export class ReportsService {
    constructor(
        private readonly db: DatabaseService,
        private readonly audit: AuditService
    ) {}

    async create(
        dto: ReportCreateDto,
        actor?: IAuthUser
    ): Promise<ReportResponseDto> {
        const report = await this.db.report.create({
            data: {
                ...dto,
                publishedAt: dto.publishedAt ?? new Date(),
            },
        });
        await this.audit.record(actor, 'REPORT_CREATED', 'Report', report.id, {
            label: report.title,
        });
        return report;
    }

    async findAll(query: ReportQueryDto): Promise<ReportListResponseDto> {
        const limit = query.limit ?? 20;

        const rows = await this.db.report.findMany({
            take: limit + 1,
            ...cursorArgs(query.cursor),
            orderBy: [{ publishedAt: 'desc' }, { id: 'desc' }],
        });

        const { items, nextCursor } = toCursorPage(rows, limit);

        return { items, nextCursor };
    }

    async findOne(id: string): Promise<ReportResponseDto> {
        const report = await this.db.report.findUnique({ where: { id } });
        if (!report) throw new NotFoundException('report.error.notFound');
        return report;
    }
}

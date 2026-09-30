import { Injectable, NotFoundException } from '@nestjs/common';

import { DatabaseService } from 'src/common/database/services/database.service';

import { ReportCreateDto } from './dtos/request/report.create.dto';
import { ReportQueryDto } from './dtos/request/report.query.dto';
import {
    ReportListResponseDto,
    ReportResponseDto,
} from './dtos/response/report.response.dto';

@Injectable()
export class ReportsService {
    constructor(private readonly db: DatabaseService) {}

    async create(dto: ReportCreateDto): Promise<ReportResponseDto> {
        return this.db.report.create({
            data: {
                ...dto,
                publishedAt: dto.publishedAt ?? new Date(),
            },
        });
    }

    async findAll(query: ReportQueryDto): Promise<ReportListResponseDto> {
        const limit = query.limit ?? 20;

        const items = await this.db.report.findMany({
            take: limit + 1,
            ...(query.cursor ? { skip: 1, cursor: { id: query.cursor } } : {}),
            orderBy: { publishedAt: 'desc' },
        });

        let nextCursor: string | undefined;
        if (items.length > limit) {
            const last = items.pop();
            nextCursor = last?.id;
        }

        return { items, nextCursor };
    }

    async findOne(id: string): Promise<ReportResponseDto> {
        const report = await this.db.report.findUnique({ where: { id } });
        if (!report) throw new NotFoundException('report.error.notFound');
        return report;
    }
}

import { Test, TestingModule } from '@nestjs/testing';

import { DatabaseService } from 'src/common/database/services/database.service';
import { ReportsService } from 'src/modules/reports/reports.service';

const db = {
    report: {
        findMany: jest.fn(),
    },
};

describe('ReportsService', () => {
    let service: ReportsService;

    beforeEach(async () => {
        jest.clearAllMocks();

        const module: TestingModule = await Test.createTestingModule({
            providers: [
                ReportsService,
                { provide: DatabaseService, useValue: db },
            ],
        }).compile();

        service = module.get(ReportsService);
    });

    describe('findAll', () => {
        it('uses the last returned report as the next cursor', async () => {
            db.report.findMany.mockResolvedValue(
                Array.from({ length: 4 }, (_, index) => ({
                    id: `report-${index + 1}`,
                }))
            );

            const result = await service.findAll({ limit: 3 });

            expect(result.items.map(report => report.id)).toEqual([
                'report-1',
                'report-2',
                'report-3',
            ]);
            expect(result.nextCursor).toBe('report-3');
        });

        it('skips the cursor when requesting the next page', async () => {
            db.report.findMany.mockResolvedValue([]);

            await service.findAll({ cursor: 'report-3', limit: 3 });

            expect(db.report.findMany).toHaveBeenCalledWith(
                expect.objectContaining({
                    cursor: { id: 'report-3' },
                    skip: 1,
                    take: 4,
                })
            );
        });
    });
});

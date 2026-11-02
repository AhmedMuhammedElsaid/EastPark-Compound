import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsISO8601, IsOptional } from 'class-validator';

/**
 * Optional optimistic-lock token for admin approve / reject: the `updatedAt`
 * of the listing as the admin saw it. A newer edit makes the call fail with
 * 409 `listing.error.changedSinceLoaded`.
 */
export class ListingApproveDto {
    @ApiPropertyOptional({ example: '2026-11-02T10:00:00.000Z' })
    @IsOptional()
    @IsISO8601()
    expectedUpdatedAt?: string;
}

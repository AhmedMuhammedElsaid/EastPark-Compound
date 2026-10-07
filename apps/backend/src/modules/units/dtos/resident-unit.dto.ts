import { ApiProperty, PickType } from '@nestjs/swagger';
import { Expose } from 'class-transformer';

import { formatUnitLabel } from 'src/common/helper/utils/unit-label';
import { ResidentLeadCreateDto } from 'src/modules/residents/dtos/request/resident-lead.create.dto';

/**
 * `POST /admin/user/:id/units` body. Picks the lead DTO's own building/floor/
 * flatNumber validators so a hand-typed flat is validated exactly like a
 * registration and cannot reach the unique key in a different spelling.
 */
export class ResidentUnitCreateDto extends PickType(ResidentLeadCreateDto, [
    'building',
    'floor',
    'flatNumber',
] as const) {}

/** One flat owned by an account. Every field is exposed (profile serializer). */
export class ResidentUnitDto {
    @ApiProperty({ example: 'clx1234567890' })
    @Expose()
    id: string;

    @ApiProperty({ example: 'A1' })
    @Expose()
    building: string;

    @ApiProperty({ example: '3' })
    @Expose()
    floor: string;

    @ApiProperty({ example: '2' })
    @Expose()
    flatNumber: string;

    @ApiProperty({
        example: 'A1-3-2',
        description: '`${building}-${floor}-${flatNumber}`',
    })
    @Expose()
    label: string;

    @ApiProperty({ example: '2026-10-07T10:30:00.000Z' })
    @Expose()
    createdAt: Date;
}

/** Columns needed to build a `ResidentUnitDto`. */
export const RESIDENT_UNIT_SELECT = {
    id: true,
    building: true,
    floor: true,
    flatNumber: true,
    createdAt: true,
} as const;

/** Oldest first, id as the tie-breaker. */
export const RESIDENT_UNIT_ORDER = [
    { createdAt: 'asc' as const },
    { id: 'asc' as const },
];

export function toResidentUnitDto(unit: {
    id: string;
    building: string;
    floor: string;
    flatNumber: string;
    createdAt: Date;
}): ResidentUnitDto {
    return {
        id: unit.id,
        building: unit.building,
        floor: unit.floor,
        flatNumber: unit.flatNumber,
        label: formatUnitLabel(unit),
        createdAt: unit.createdAt,
    };
}

import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

import { TRASH_TYPES, TrashType } from './trash.request.dto';

export class TrashDeletedByDto {
    @ApiProperty() id: string;
    @ApiProperty() name: string;
}

export class TrashItemDto {
    @ApiProperty({ enum: TRASH_TYPES }) type: TrashType;
    @ApiProperty() id: string;
    @ApiProperty({ example: 'Sara (sara@example.com)' }) label: string;
    @ApiProperty({ type: String, nullable: true, example: 'RESIDENT · B1-2-3' })
    sublabel: string | null;
    @ApiProperty({ type: Date, nullable: true }) deletedAt: Date | null;
    @ApiProperty({ type: TrashDeletedByDto, nullable: true })
    deletedBy: TrashDeletedByDto | null;
    @ApiProperty() restorable: boolean;
    @ApiProperty({
        type: String,
        nullable: true,
        example: 'trash.error.parentDeleted',
        description: 'Error key explaining why restore would fail',
    })
    reason: string | null;
}

export class TrashListResponseDto {
    @ApiProperty({ type: [TrashItemDto] }) items: TrashItemDto[];
    @ApiPropertyOptional() nextCursor?: string;
}

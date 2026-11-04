import { ApiProperty, ApiPropertyOptional, OmitType } from '@nestjs/swagger';
import { ListingStatus, ListingType } from '@prisma/client';

export class ListingOwnerDto {
    @ApiProperty()
    id: string;

    @ApiProperty()
    name: string;
}

export class ListingAdminOwnerDto extends ListingOwnerDto {
    @ApiProperty()
    email: string;

    @ApiProperty({ nullable: true, type: String })
    phone: string | null;
}

/** Public shape: what a browsing resident sees. */
export class ListingDto {
    @ApiProperty()
    id: string;

    @ApiProperty({ enum: ListingType })
    type: ListingType;

    @ApiProperty({ enum: ListingStatus })
    status: ListingStatus;

    @ApiProperty({ example: 'A1' })
    building: string;

    @ApiProperty({ example: '3' })
    floor: string;

    @ApiProperty({ example: '2' })
    flatNumber: string;

    @ApiProperty({ example: 'A1-3-2' })
    unitLabel: string;

    @ApiProperty({ example: 2500000 })
    price: number;

    @ApiProperty()
    areaSqm: number;

    @ApiProperty()
    bedrooms: number;

    @ApiProperty()
    bathrooms: number;

    @ApiProperty()
    furnished: boolean;

    @ApiProperty({ nullable: true, type: String })
    description: string | null;

    @ApiProperty()
    contactPhone: string;

    @ApiProperty({ type: [String] })
    photos: string[];

    @ApiProperty({ nullable: true, type: Date })
    approvedAt: Date | null;

    @ApiProperty({ nullable: true, type: Date })
    expiresAt: Date | null;

    @ApiProperty()
    createdAt: Date;

    @ApiProperty()
    updatedAt: Date;

    @ApiProperty({ type: ListingOwnerDto })
    owner: ListingOwnerDto;
}

/** The owner's own view: adds the moderation reason. */
export class MyListingDto extends ListingDto {
    @ApiProperty({ nullable: true, type: String })
    rejectReason: string | null;
}

export class AdminListingDto extends OmitType(MyListingDto, ['owner'] as const) {
    @ApiProperty({ type: ListingAdminOwnerDto })
    owner: ListingAdminOwnerDto;

    @ApiProperty()
    revisionCount: number;
}

/** One entry of `ListingRevisionDto.changes`. */
export class ListingChangeDto {
    @ApiProperty({ example: 'price' })
    field: string;

    @ApiPropertyOptional({ description: 'Previous value (scalar fields)' })
    from?: unknown;

    @ApiPropertyOptional({ description: 'New value (scalar fields)' })
    to?: unknown;

    @ApiPropertyOptional({ type: [String], description: 'photos only' })
    added?: string[];

    @ApiPropertyOptional({ type: [String], description: 'photos only' })
    removed?: string[];

    @ApiPropertyOptional({
        description: 'photos only: the order changed (always true for order-only edits)',
    })
    reordered?: boolean;
}

export class ListingRevisionEditorDto {
    @ApiProperty()
    id: string;

    @ApiProperty()
    name: string;
}

export class ListingRevisionDto {
    @ApiProperty()
    id: string;

    @ApiProperty()
    createdAt: Date;

    @ApiProperty({ type: ListingRevisionEditorDto })
    editor: ListingRevisionEditorDto;

    @ApiProperty({ type: [ListingChangeDto] })
    changes: ListingChangeDto[];
}

export class ListingPageDto {
    @ApiProperty({ type: [ListingDto] })
    items: ListingDto[];

    @ApiPropertyOptional({ nullable: true, type: String })
    nextCursor?: string | null;
}

export class MyListingPageDto {
    @ApiProperty({ type: [MyListingDto] })
    items: MyListingDto[];

    @ApiPropertyOptional({ nullable: true, type: String })
    nextCursor?: string | null;
}

export class AdminListingPageDto {
    @ApiProperty({ type: [AdminListingDto] })
    items: AdminListingDto[];

    @ApiPropertyOptional({ nullable: true, type: String })
    nextCursor?: string | null;
}

export class ListingRevisionPageDto {
    @ApiProperty({ type: [ListingRevisionDto] })
    items: ListingRevisionDto[];

    @ApiPropertyOptional({ nullable: true, type: String })
    nextCursor?: string | null;
}

export class ListingStatsDto {
    @ApiProperty() PENDING: number;
    @ApiProperty() APPROVED: number;
    @ApiProperty() REJECTED: number;
    @ApiProperty() SOLD: number;
    @ApiProperty() RENTED: number;
    @ApiProperty() WITHDRAWN: number;
    @ApiProperty() EXPIRED: number;
    @ApiProperty() total: number;
}

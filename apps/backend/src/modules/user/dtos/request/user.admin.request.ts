import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { Transform, Type } from 'class-transformer';
import {
    IsEnum,
    IsIn,
    IsInt,
    IsOptional,
    IsString,
    Max,
    MaxLength,
    Min,
} from 'class-validator';

/** Roles the SUPER_ADMIN can assign. SUPER_ADMIN/GUEST are never assignable. */
export const ASSIGNABLE_ROLES = [Role.RESIDENT, Role.MERCHANT, Role.ADMIN] as const;
export type AssignableRole = (typeof ASSIGNABLE_ROLES)[number];

export class AdminUserQueryDto {
    @ApiPropertyOptional()
    @IsString()
    @IsOptional()
    cursor?: string;

    @ApiPropertyOptional({ default: 20 })
    @Type(() => Number)
    @IsInt()
    @Min(1)
    @Max(50)
    @IsOptional()
    limit?: number = 20;

    @ApiPropertyOptional({ description: 'Case-insensitive match on name or email' })
    @Transform(({ value }: { value: unknown }) =>
        typeof value === 'string' ? value.trim() : value
    )
    @IsString()
    @MaxLength(100)
    @IsOptional()
    q?: string;

    @ApiPropertyOptional({ enum: Role })
    @IsEnum(Role)
    @IsOptional()
    role?: Role;
}

/** `GET /admin/user/merchants` [ADMIN] — the merchant picker for "create shop". */
export class AdminMerchantQueryDto {
    @ApiPropertyOptional()
    @IsString()
    @IsOptional()
    cursor?: string;

    @ApiPropertyOptional({ default: 20 })
    @Type(() => Number)
    @IsInt()
    @Min(1)
    @Max(50)
    @IsOptional()
    limit?: number = 20;

    @ApiPropertyOptional({ description: 'Case-insensitive match on name or email' })
    @Transform(({ value }: { value: unknown }) =>
        typeof value === 'string' ? value.trim() : value
    )
    @IsString()
    @MaxLength(100)
    @IsOptional()
    q?: string;
}

export class AdminUserRoleUpdateDto {
    @ApiProperty({ enum: ASSIGNABLE_ROLES })
    @IsIn(ASSIGNABLE_ROLES)
    role: AssignableRole;
}

import { ApiHideProperty, ApiProperty } from '@nestjs/swagger';
import { $Enums, User } from '@prisma/client';
import { Exclude, Expose, Type } from 'class-transformer';
import {
    IsBoolean,
    IsDate,
    IsEmail,
    IsEnum,
    IsOptional,
    IsString,
} from 'class-validator';

import { ResidentUnitDto } from 'src/modules/units/dtos/resident-unit.dto';

export class UserResponseDto implements Partial<User> {
    @ApiProperty({ example: 'clx1234567890' })
    @Expose()
    @IsString()
    id: string;

    @ApiProperty({ example: 'Ahmed Hassan' })
    @Expose()
    @IsString()
    name: string;

    @ApiProperty({ example: 'ahmed@example.com' })
    @Expose()
    @IsEmail()
    email: string;

    @ApiProperty({ example: '+201234567890', required: false, nullable: true })
    @Expose()
    @IsString()
    @IsOptional()
    phone: string | null;

    @ApiProperty({ example: 'A1-301', required: false, nullable: true })
    @Expose()
    @IsString()
    @IsOptional()
    unitNumber: string | null;

    @ApiProperty({
        example: 'https://storage.example.com/avatars/user.jpg',
        required: false,
        nullable: true,
    })
    @Expose()
    @IsString()
    @IsOptional()
    avatarUrl: string | null;

    @ApiProperty({ enum: $Enums.Role, example: $Enums.Role.RESIDENT })
    @Expose()
    @IsEnum($Enums.Role)
    role: $Enums.Role;

    @ApiProperty({ example: false })
    @Expose()
    @IsBoolean()
    isVerified: boolean;

    @ApiProperty({ example: '2026-01-15T10:30:00.000Z' })
    @Expose()
    @IsDate()
    createdAt: Date;

    @ApiProperty({ example: '2026-09-30T10:30:00.000Z' })
    @Expose()
    @IsDate()
    updatedAt: Date;

    // ── Excluded fields (never sent to client) ────────────────────────────────

    @ApiHideProperty()
    @Exclude()
    passwordHash?: string;

    @ApiHideProperty()
    @Exclude()
    pushToken?: string | null;
}

export class UserGetProfileResponseDto extends UserResponseDto {
    @ApiProperty({
        type: [ResidentUnitDto],
        description:
            'Every flat the account owns, oldest first. `unitNumber` is the primary flat label.',
    })
    @Expose()
    @Type(() => ResidentUnitDto)
    units: ResidentUnitDto[];
}
export class UserUpdateProfileResponseDto extends UserResponseDto {}

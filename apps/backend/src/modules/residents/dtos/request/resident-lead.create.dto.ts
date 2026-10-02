import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { MaritalStatus } from '@prisma/client';
import { Transform } from 'class-transformer';
import {
    IsEmail,
    IsEnum,
    IsNotEmpty,
    IsOptional,
    IsString,
    Length,
    Matches,
} from 'class-validator';

import { NormalizeEmail } from 'src/common/helper/transforms/normalize-email.transform';

export class ResidentLeadCreateDto {
    @ApiProperty({ example: 'Ahmed Hassan' })
    @IsString()
    @IsNotEmpty()
    @Length(2, 100)
    name: string;

    @ApiProperty({ example: 'ahmed@example.com' })
    @NormalizeEmail()
    @IsEmail()
    @IsNotEmpty()
    email: string;

    // Deliberately permissive, and NOT @IsPhoneNumber(): with no region that
    // decorator demands E.164, so the local Egyptian form residents actually
    // type ("01000400163") would 400 on every submission. On a public lead
    // form, losing the lead costs more than storing an odd format.
    // Separators are stripped before validation.
    @ApiProperty({
        example: '01000400163',
        description: 'Egyptian mobile — "01xxxxxxxxx" or "+201xxxxxxxxx"',
    })
    @Transform(({ value }) =>
        typeof value === 'string' ? value.replace(/[\s()-]/g, '') : value
    )
    @IsString()
    @IsNotEmpty()
    @Matches(/^(?:\+?20|0)1[0125]\d{8}$/, {
        message:
            'phone must be a valid Egyptian mobile number, e.g. 01000400163',
    })
    phone: string;

    @ApiProperty({ example: 'Building A' })
    @IsString()
    @IsNotEmpty()
    building: string;

    // String, not Int: ground floor is submitted as "G" (phases 2 and 3 only),
    // and leading-zero forms like "01" must survive round-tripping.
    @ApiProperty({ example: '3', description: '"G" (ground) or "1".."11"' })
    @IsString()
    @IsNotEmpty()
    @Matches(/^(G|[1-9]|1[01])$/, {
        message: 'floor must be "G" or a number from 1 to 11',
    })
    floor: string;

    @ApiProperty({ example: '2', description: '"1".."5"' })
    @IsString()
    @IsNotEmpty()
    @Matches(/^[1-5]$/, { message: 'flatNumber must be a number from 1 to 5' })
    flatNumber: string;

    @ApiPropertyOptional({ example: 'B-12' })
    @IsString()
    @IsOptional()
    parking?: string;

    @ApiPropertyOptional({ example: 'Engineer', maxLength: 100 })
    @IsString()
    @IsOptional()
    @Length(1, 100)
    jobTitle?: string;

    @ApiPropertyOptional({ enum: MaritalStatus })
    @IsEnum(MaritalStatus)
    @IsOptional()
    maritalStatus?: MaritalStatus;

    @ApiPropertyOptional({ example: '29801011234567', minLength: 14, maxLength: 14 })
    @IsString()
    @IsOptional()
    @Matches(/^\d{14}$/, { message: 'nationalId must contain exactly 14 digits' })
    nationalId?: string;

    @ApiPropertyOptional({ example: 'A12345678', maxLength: 30 })
    @IsString()
    @IsOptional()
    @Length(1, 30)
    passportNumber?: string;
}

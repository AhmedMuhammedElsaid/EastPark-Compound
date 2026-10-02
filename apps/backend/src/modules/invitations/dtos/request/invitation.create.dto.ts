import { ApiProperty } from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { IsEmail, IsEnum, IsNotEmpty } from 'class-validator';

import { NormalizeEmail } from 'src/common/helper/transforms/normalize-email.transform';

export class InvitationCreateDto {
    @ApiProperty({ example: 'merchant@example.com' })
    @NormalizeEmail()
    @IsEmail()
    @IsNotEmpty()
    email: string;

    @ApiProperty({ enum: [Role.RESIDENT, Role.MERCHANT, Role.ADMIN] })
    @IsEnum([Role.RESIDENT, Role.MERCHANT, Role.ADMIN])
    role: typeof Role.RESIDENT | typeof Role.MERCHANT | typeof Role.ADMIN;
}

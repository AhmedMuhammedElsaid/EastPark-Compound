import { ApiProperty } from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { IsEmail, IsEnum, IsNotEmpty } from 'class-validator';

import { NormalizeEmail } from 'src/common/helper/transforms/normalize-email.transform';

export const INVITATION_ROLES = [
    Role.RESIDENT,
    Role.MERCHANT,
    Role.ADMIN,
    Role.ACCOUNTANT,
] as const;
export type InvitationRole = (typeof INVITATION_ROLES)[number];

export class InvitationCreateDto {
    @ApiProperty({ example: 'merchant@example.com' })
    @NormalizeEmail()
    @IsEmail()
    @IsNotEmpty()
    email: string;

    /** SUPER_ADMIN is never an invitation role; ADMIN needs a SUPER_ADMIN actor. */
    @ApiProperty({ enum: INVITATION_ROLES })
    @IsEnum(INVITATION_ROLES)
    role: InvitationRole;
}

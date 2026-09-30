import { ApiProperty } from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { IsEmail, IsEnum, IsNotEmpty } from 'class-validator';

export class InvitationCreateDto {
    @ApiProperty({ example: 'merchant@example.com' })
    @IsEmail()
    @IsNotEmpty()
    email: string;

    @ApiProperty({ enum: [Role.RESIDENT, Role.MERCHANT, Role.ADMIN] })
    @IsEnum([Role.RESIDENT, Role.MERCHANT, Role.ADMIN])
    role: typeof Role.RESIDENT | typeof Role.MERCHANT | typeof Role.ADMIN;
}

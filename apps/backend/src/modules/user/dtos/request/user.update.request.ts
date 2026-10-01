import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
    IsOptional,
    IsPhoneNumber,
    IsString,
    IsUrl,
    Length,
} from 'class-validator';

export class UserUpdateDto {
    @ApiProperty({ example: 'Ahmed Hassan', required: false })
    @IsString()
    @IsOptional()
    @Length(2, 100)
    @Transform(({ value }: { value: string }) => value?.trim())
    name?: string;

    @ApiProperty({ example: '+201234567890', required: false, nullable: true })
    @IsPhoneNumber()
    @IsOptional()
    phone?: string | null;

    @ApiProperty({ example: 'B2-405', required: false, nullable: true })
    @IsString()
    @IsOptional()
    unitNumber?: string | null;

    @ApiProperty({
        example: 'https://storage.example.com/avatars/user.jpg',
        required: false,
        nullable: true,
    })
    @IsUrl()
    @IsOptional()
    avatarUrl?: string | null;
}

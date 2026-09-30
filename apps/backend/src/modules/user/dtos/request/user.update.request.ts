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

    @ApiProperty({ example: '+201234567890', required: false })
    @IsPhoneNumber()
    @IsOptional()
    phone?: string;

    @ApiProperty({ example: 'B2-405', required: false })
    @IsString()
    @IsOptional()
    unitNumber?: string;

    @ApiProperty({
        example: 'https://storage.example.com/avatars/user.jpg',
        required: false,
    })
    @IsUrl()
    @IsOptional()
    avatarUrl?: string;
}

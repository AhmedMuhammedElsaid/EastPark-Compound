import {
    BadRequestException,
    Controller,
    HttpCode,
    HttpStatus,
    Post,
    Req,
} from '@nestjs/common';
import {
    ApiBearerAuth,
    ApiConsumes,
    ApiOperation,
    ApiTags,
} from '@nestjs/swagger';
import { FastifyRequest } from 'fastify';

import {
    FileService,
    UploadResult,
} from 'src/common/file/services/files.service';
import { ENUM_FILE_STORE } from 'src/common/file/enums/files.enum';
import { AuthUser } from 'src/common/request/decorators/request.user.decorator';
import { IAuthUser } from 'src/common/request/interfaces/request.interface';

@ApiTags('uploads')
@ApiBearerAuth('accessToken')
@Controller({ path: '/uploads', version: '1' })
export class UploadsController {
    constructor(private readonly fileService: FileService) {}

    @Post('image')
    @HttpCode(HttpStatus.OK)
    @ApiConsumes('multipart/form-data')
    @ApiOperation({
        summary: 'Upload image (≤5MB jpg/png/webp) → returns { url, path }',
    })
    async uploadImage(
        @Req() req: FastifyRequest,
        @AuthUser() actor: IAuthUser
    ): Promise<UploadResult> {
        const data = await req.file();
        if (!data) throw new BadRequestException('upload.error.noFile');

        const buffer = await data.toBuffer();
        return this.fileService.uploadImage(
            buffer,
            data.filename,
            data.mimetype,
            ENUM_FILE_STORE.USER_AVATARS,
            actor.userId
        );
    }

    @Post('pdf')
    @HttpCode(HttpStatus.OK)
    @ApiConsumes('multipart/form-data')
    @ApiOperation({ summary: 'Upload PDF (≤20MB) → returns { url, path }' })
    async uploadPdf(
        @Req() req: FastifyRequest,
        @AuthUser() actor: IAuthUser
    ): Promise<UploadResult> {
        const data = await req.file();
        if (!data) throw new BadRequestException('upload.error.noFile');

        const buffer = await data.toBuffer();
        return this.fileService.uploadPdf(
            buffer,
            data.filename,
            ENUM_FILE_STORE.REPORTS,
            actor.userId
        );
    }
}

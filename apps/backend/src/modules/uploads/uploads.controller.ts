import {
    BadRequestException,
    Controller,
    HttpCode,
    HttpStatus,
    Post,
    Query,
    Req,
} from '@nestjs/common';
import {
    ApiBearerAuth,
    ApiConsumes,
    ApiOperation,
    ApiQuery,
    ApiTags,
} from '@nestjs/swagger';
import type { MultipartFile } from '@fastify/multipart';
import { Role } from '@prisma/client';
import { FastifyRequest } from 'fastify';

import {
    FileService,
    UploadResult,
} from 'src/common/file/services/files.service';
import { AllowedRoles } from 'src/common/request/decorators/request.role.decorator';
import { AuthUser } from 'src/common/request/decorators/request.user.decorator';
import { IAuthUser } from 'src/common/request/interfaces/request.interface';

import {
    DEFAULT_IMAGE_PURPOSE,
    DEFAULT_PDF_PURPOSE,
    IMAGE_UPLOAD_PURPOSES,
    PDF_UPLOAD_PURPOSES,
    resolveUploadStore,
} from './upload-purpose';

type MultipartRequest = FastifyRequest & {
    file: () => Promise<MultipartFile | undefined>;
};

@ApiTags('uploads')
@ApiBearerAuth('accessToken')
@Controller({ path: '/uploads', version: '1' })
export class UploadsController {
    constructor(private readonly fileService: FileService) {}

    @Post('image')
    @HttpCode(HttpStatus.OK)
    @ApiConsumes('multipart/form-data')
    @ApiQuery({
        name: 'purpose',
        required: false,
        enum: Object.keys(IMAGE_UPLOAD_PURPOSES),
        description:
            'Storage folder. Default `avatar`. shop/product: MERCHANT/ADMIN; candidate/announcement: ADMIN.',
    })
    @ApiOperation({
        summary: 'Upload image (≤5MB jpg/png/webp) → returns { url, path }',
    })
    async uploadImage(
        @Req() req: MultipartRequest,
        @AuthUser() actor: IAuthUser,
        @Query('purpose') purpose?: string
    ): Promise<UploadResult> {
        const store = resolveUploadStore(
            IMAGE_UPLOAD_PURPOSES,
            purpose,
            DEFAULT_IMAGE_PURPOSE,
            actor.role
        );
        const data = await req.file();
        if (!data) throw new BadRequestException('upload.error.noFile');

        const buffer = await data.toBuffer();
        return this.fileService.uploadImage(buffer, store, actor.userId);
    }

    @Post('pdf')
    @AllowedRoles([Role.ADMIN])
    @HttpCode(HttpStatus.OK)
    @ApiConsumes('multipart/form-data')
    @ApiQuery({
        name: 'purpose',
        required: false,
        enum: Object.keys(PDF_UPLOAD_PURPOSES),
        description: 'Storage folder. Default `report`.',
    })
    @ApiOperation({
        summary: 'Upload PDF (≤20MB) → returns { url, path } [ADMIN]',
    })
    async uploadPdf(
        @Req() req: MultipartRequest,
        @AuthUser() actor: IAuthUser,
        @Query('purpose') purpose?: string
    ): Promise<UploadResult> {
        const store = resolveUploadStore(
            PDF_UPLOAD_PURPOSES,
            purpose,
            DEFAULT_PDF_PURPOSE,
            actor.role
        );
        const data = await req.file();
        if (!data) throw new BadRequestException('upload.error.noFile');

        const buffer = await data.toBuffer();
        return this.fileService.uploadPdf(buffer, store, actor.userId);
    }
}

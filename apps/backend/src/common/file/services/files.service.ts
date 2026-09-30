import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createClient, SupabaseClient } from '@supabase/supabase-js';

import {
    ENUM_FILE_ALLOWED_IMAGE,
    ENUM_FILE_ALLOWED_PDF,
    ENUM_FILE_STORE,
    FILE_MAX_IMAGE_SIZE,
    FILE_MAX_PDF_SIZE,
} from '../enums/files.enum';

export interface UploadResult {
    url: string;
    path: string;
}

@Injectable()
export class FileService {
    private readonly logger = new Logger(FileService.name);
    private readonly supabase: SupabaseClient;
    private readonly bucket: string;

    constructor(private readonly config: ConfigService) {
        this.supabase = createClient(
            config.getOrThrow<string>('supabase.url'),
            config.getOrThrow<string>('supabase.serviceKey')
        );
        this.bucket = config.getOrThrow<string>('supabase.bucket');
    }

    async uploadImage(
        buffer: Buffer,
        fileName: string,
        contentType: string,
        storeType: ENUM_FILE_STORE,
        ownerId: string
    ): Promise<UploadResult> {
        const allowed = Object.values(ENUM_FILE_ALLOWED_IMAGE) as string[];
        if (!allowed.includes(contentType)) {
            throw new BadRequestException(
                `Allowed image types: ${allowed.join(', ')}`
            );
        }
        if (buffer.length > FILE_MAX_IMAGE_SIZE) {
            throw new BadRequestException('Image must be ≤ 5 MB');
        }
        return this.upload(buffer, fileName, contentType, storeType, ownerId);
    }

    async uploadPdf(
        buffer: Buffer,
        fileName: string,
        storeType: ENUM_FILE_STORE,
        ownerId: string
    ): Promise<UploadResult> {
        if (buffer.length > FILE_MAX_PDF_SIZE) {
            throw new BadRequestException('PDF must be ≤ 20 MB');
        }
        return this.upload(
            buffer,
            fileName,
            ENUM_FILE_ALLOWED_PDF.PDF,
            storeType,
            ownerId
        );
    }

    async deleteFile(filePath: string): Promise<void> {
        const { error } = await this.supabase.storage
            .from(this.bucket)
            .remove([filePath]);
        if (error) {
            this.logger.warn(
                `Failed to delete file ${filePath}: ${error.message}`
            );
        }
    }

    private async upload(
        buffer: Buffer,
        fileName: string,
        contentType: string,
        storeType: ENUM_FILE_STORE,
        ownerId: string
    ): Promise<UploadResult> {
        const ext = fileName.split('.').pop() ?? 'bin';
        const storagePath = `${storeType}/${ownerId}/${Date.now()}.${ext}`;

        const { error } = await this.supabase.storage
            .from(this.bucket)
            .upload(storagePath, buffer, { contentType, upsert: false });

        if (error) {
            this.logger.error(`Supabase upload failed: ${error.message}`);
            throw new Error(`Upload failed: ${error.message}`);
        }

        const { data } = this.supabase.storage
            .from(this.bucket)
            .getPublicUrl(storagePath);

        this.logger.log(`Uploaded ${storagePath}`);
        return { url: data.publicUrl, path: storagePath };
    }
}

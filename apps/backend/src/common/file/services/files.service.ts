import {
    BadGatewayException,
    BadRequestException,
    Injectable,
    Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomUUID } from 'node:crypto';
import { createClient, SupabaseClient } from '@supabase/supabase-js';

import {
    ENUM_FILE_STORE,
    FILE_MAX_IMAGE_SIZE,
    FILE_MAX_PDF_SIZE,
} from '../enums/files.enum';
import {
    DetectedFileType,
    detectImageType,
    detectPdf,
} from '../file-signature';
import { IFilesService } from '../interfaces/files.service.interface';

export interface UploadResult {
    url: string;
    path: string;
}

@Injectable()
export class FileService implements IFilesService {
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

    /** JPEG / PNG / WEBP, ≤ 5 MB. Type is sniffed from the bytes. */
    async uploadImage(
        buffer: Buffer,
        storeType: ENUM_FILE_STORE,
        ownerId: string
    ): Promise<UploadResult> {
        if (buffer.length > FILE_MAX_IMAGE_SIZE) {
            throw new BadRequestException('Image must be ≤ 5 MB');
        }
        const detected = detectImageType(buffer);
        if (!detected) {
            throw new BadRequestException(
                'Allowed image types: image/jpeg, image/png, image/webp'
            );
        }
        return this.upload(buffer, detected, storeType, ownerId);
    }

    /** PDF (`%PDF-` signature), ≤ 20 MB. */
    async uploadPdf(
        buffer: Buffer,
        storeType: ENUM_FILE_STORE,
        ownerId: string
    ): Promise<UploadResult> {
        if (buffer.length > FILE_MAX_PDF_SIZE) {
            throw new BadRequestException('PDF must be ≤ 20 MB');
        }
        const detected = detectPdf(buffer);
        if (!detected) {
            throw new BadRequestException('File is not a valid PDF');
        }
        return this.upload(buffer, detected, storeType, ownerId);
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
        detected: DetectedFileType,
        storeType: ENUM_FILE_STORE,
        ownerId: string
    ): Promise<UploadResult> {
        // Extension comes from the sniffed type — never from the filename.
        const storagePath = `${storeType}/${ownerId}/${Date.now()}-${randomUUID()}.${detected.ext}`;

        const { error } = await this.supabase.storage
            .from(this.bucket)
            .upload(storagePath, buffer, {
                contentType: detected.mime,
                upsert: false,
            });

        // The bucket is provisioned manually by the owner; never auto-create
        // it. Log the real cause server-side, return a safe code to clients.
        if (error) {
            this.logger.error(
                `Supabase upload to bucket "${this.bucket}" failed: ${error.message}`
            );
            throw new BadGatewayException('storage_unavailable');
        }

        const { data } = this.supabase.storage
            .from(this.bucket)
            .getPublicUrl(storagePath);

        this.logger.log(`Uploaded ${storagePath}`);
        return { url: data.publicUrl, path: storagePath };
    }
}

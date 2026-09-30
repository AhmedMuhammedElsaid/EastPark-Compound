import { ENUM_FILE_STORE } from '../enums/files.enum';
import { UploadResult } from '../services/files.service';

export interface IFilesService {
    uploadImage(
        buffer: Buffer,
        fileName: string,
        contentType: string,
        storeType: ENUM_FILE_STORE,
        ownerId: string
    ): Promise<UploadResult>;

    uploadPdf(
        buffer: Buffer,
        fileName: string,
        storeType: ENUM_FILE_STORE,
        ownerId: string
    ): Promise<UploadResult>;

    deleteFile(filePath: string): Promise<void>;
}

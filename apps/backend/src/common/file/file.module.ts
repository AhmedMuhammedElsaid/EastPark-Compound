import { Module } from '@nestjs/common';

import { FileService } from './services/files.service';
import { PrivateFileService } from './services/private-file.service';

@Module({
    providers: [FileService, PrivateFileService],
    exports: [FileService, PrivateFileService],
})
export class FileModule {}

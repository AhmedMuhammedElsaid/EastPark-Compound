import { Module } from '@nestjs/common';

import { FileService } from './services/files.service';

@Module({
    providers: [FileService],
    exports: [FileService],
})
export class FileModule {}

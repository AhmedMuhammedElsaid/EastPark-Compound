import {
    Controller,
    Get,
    HttpCode,
    HttpStatus,
    Param,
    Post,
    Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Role } from '@prisma/client';

import { AllowedRoles } from 'src/common/request/decorators/request.role.decorator';
import { AuthUser } from 'src/common/request/decorators/request.user.decorator';
import { IAuthUser } from 'src/common/request/interfaces/request.interface';

import { TrashQueryDto, TrashRestoreParamsDto } from './dtos/trash.request.dto';
import {
    TrashItemDto,
    TrashListResponseDto,
} from './dtos/trash.response.dto';
import { TrashService } from './trash.service';

@ApiTags('admin.trash')
@ApiBearerAuth('accessToken')
@Controller({ path: '/admin/trash', version: '1' })
export class TrashAdminController {
    constructor(private readonly trashService: TrashService) {}

    @Get()
    @AllowedRoles([Role.SUPER_ADMIN])
    @HttpCode(HttpStatus.OK)
    @ApiOperation({
        summary: 'Recycle bin: soft-deleted records of one type, newest first [SUPER_ADMIN]',
    })
    list(@Query() query: TrashQueryDto): Promise<TrashListResponseDto> {
        return this.trashService.list(query);
    }

    @Post(':type/:id/restore')
    @AllowedRoles([Role.SUPER_ADMIN])
    @HttpCode(HttpStatus.OK)
    @ApiOperation({ summary: 'Restore a soft-deleted record [SUPER_ADMIN]' })
    restore(
        @Param() params: TrashRestoreParamsDto,
        @AuthUser() actor: IAuthUser
    ): Promise<TrashItemDto> {
        return this.trashService.restore(params.type, params.id, actor);
    }
}

import {
    Body,
    Controller,
    Delete,
    Get,
    HttpCode,
    HttpStatus,
    Param,
    Patch,
    Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Role } from '@prisma/client';

import { DocGenericResponse } from 'src/common/doc/decorators/doc.generic.decorator';
import { AllowedRoles } from 'src/common/request/decorators/request.role.decorator';
import { AuthUser } from 'src/common/request/decorators/request.user.decorator';
import { IAuthUser } from 'src/common/request/interfaces/request.interface';
import { ApiGenericResponseDto } from 'src/common/response/dtos/response.generic.dto';

import {
    AdminUserQueryDto,
    AdminUserRoleUpdateDto,
} from '../dtos/request/user.admin.request';
import {
    AdminUserItemDto,
    AdminUserListResponseDto,
} from '../dtos/response/user.admin.response';
import { UserService } from '../services/user.service';

@ApiTags('admin.user')
@Controller({
    path: '/admin/user',
    version: '1',
})
export class UserAdminController {
    constructor(private readonly userService: UserService) {}

    @Get()
    @AllowedRoles([Role.SUPER_ADMIN])
    @HttpCode(HttpStatus.OK)
    @ApiBearerAuth('accessToken')
    @ApiOperation({ summary: 'Search users (team & roles) [SUPER_ADMIN]' })
    public list(
        @Query() query: AdminUserQueryDto
    ): Promise<AdminUserListResponseDto> {
        return this.userService.listUsers(query);
    }

    @Patch(':id/role')
    @AllowedRoles([Role.SUPER_ADMIN])
    @HttpCode(HttpStatus.OK)
    @ApiBearerAuth('accessToken')
    @ApiOperation({ summary: "Change a user's role [SUPER_ADMIN]" })
    public changeRole(
        @Param('id') userId: string,
        @Body() dto: AdminUserRoleUpdateDto,
        @AuthUser() actor: IAuthUser
    ): Promise<AdminUserItemDto> {
        return this.userService.changeRole(userId, dto.role, actor);
    }

    @Delete(':id')
    @AllowedRoles([Role.ADMIN])
    @ApiBearerAuth('accessToken')
    @ApiOperation({
        summary:
            'Delete user [ADMIN]; deleting an ADMIN requires SUPER_ADMIN, a SUPER_ADMIN is never deletable',
    })
    @DocGenericResponse({
        httpStatus: HttpStatus.OK,
        messageKey: 'user.success.deleted',
    })
    public async deleteUser(
        @Param('id') userId: string,
        @AuthUser() actor: IAuthUser
    ): Promise<ApiGenericResponseDto> {
        return this.userService.deleteUser(userId, actor);
    }
}

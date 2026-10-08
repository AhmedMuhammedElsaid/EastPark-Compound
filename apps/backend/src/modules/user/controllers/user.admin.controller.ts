import {
    Body,
    Controller,
    Delete,
    Get,
    HttpCode,
    HttpStatus,
    Param,
    Patch,
    Post,
    Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Role } from '@prisma/client';

import { DocGenericResponse } from 'src/common/doc/decorators/doc.generic.decorator';
import { DocResponse } from 'src/common/doc/decorators/doc.response.decorator';
import { AllowedRoles } from 'src/common/request/decorators/request.role.decorator';
import { AuthUser } from 'src/common/request/decorators/request.user.decorator';
import { IAuthUser } from 'src/common/request/interfaces/request.interface';
import { ApiGenericResponseDto } from 'src/common/response/dtos/response.generic.dto';
import {
    ResidentUnitCreateDto,
    ResidentUnitDto,
} from 'src/modules/units/dtos/resident-unit.dto';
import { ResidentUnitsService } from 'src/modules/units/resident-units.service';

import {
    AdminMerchantQueryDto,
    AdminUserQueryDto,
    AdminUserRoleUpdateDto,
} from '../dtos/request/user.admin.request';
import {
    AdminMerchantListResponseDto,
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
    constructor(
        private readonly userService: UserService,
        private readonly residentUnits: ResidentUnitsService
    ) {}

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

    @Get('merchants')
    @AllowedRoles([Role.ADMIN])
    @HttpCode(HttpStatus.OK)
    @ApiBearerAuth('accessToken')
    @ApiOperation({
        summary:
            'List live merchant accounts with their live shop [ADMIN] (create-shop picker)',
    })
    public listMerchants(
        @Query() query: AdminMerchantQueryDto
    ): Promise<AdminMerchantListResponseDto> {
        return this.userService.listMerchants(query);
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
    @AllowedRoles([Role.SUPER_ADMIN])
    @ApiBearerAuth('accessToken')
    @ApiOperation({
        summary:
            'Soft-delete user [SUPER_ADMIN] (restorable from the recycle bin); a SUPER_ADMIN is never deletable',
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

    @Post(':id/units')
    @AllowedRoles([Role.SUPER_ADMIN])
    @HttpCode(HttpStatus.CREATED)
    @ApiBearerAuth('accessToken')
    @ApiOperation({
        summary:
            'Add a flat to an existing account [SUPER_ADMIN] (409 if owned or in an active application)',
    })
    @DocResponse({
        serialization: ResidentUnitDto,
        httpStatus: HttpStatus.CREATED,
        messageKey: 'unit.success.added',
    })
    public addUnit(
        @Param('id') userId: string,
        @Body() dto: ResidentUnitCreateDto,
        @AuthUser() actor: IAuthUser
    ): Promise<ResidentUnitDto> {
        return this.residentUnits.addToUser(userId, dto, actor);
    }

    @Delete(':id/units/:unitId')
    @AllowedRoles([Role.SUPER_ADMIN])
    @ApiBearerAuth('accessToken')
    @ApiOperation({
        summary:
            'Remove a flat from an account [SUPER_ADMIN] (sale / transfer; works for a deleted account too)',
    })
    @DocGenericResponse({
        httpStatus: HttpStatus.OK,
        messageKey: 'unit.success.removed',
    })
    public removeUnit(
        @Param('id') userId: string,
        @Param('unitId') unitId: string,
        @AuthUser() actor: IAuthUser
    ): Promise<ApiGenericResponseDto> {
        return this.residentUnits.removeFromUser(userId, unitId, actor);
    }
}

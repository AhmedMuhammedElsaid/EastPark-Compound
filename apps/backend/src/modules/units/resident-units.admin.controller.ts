import { Body, Controller, HttpStatus, Param, Patch } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Role } from '@prisma/client';

import { DocResponse } from 'src/common/doc/decorators/doc.response.decorator';
import { AllowedRoles } from 'src/common/request/decorators/request.role.decorator';
import { AuthUser } from 'src/common/request/decorators/request.user.decorator';
import { IAuthUser } from 'src/common/request/interfaces/request.interface';

import {
    ResidentUnitDto,
    ResidentUnitKeyUpdateDto,
} from './dtos/resident-unit.dto';
import { ResidentUnitsService } from './resident-units.service';

@ApiTags('admin/resident-units')
@ApiBearerAuth('accessToken')
@Controller({ path: '/admin/resident-units', version: '1' })
export class ResidentUnitsAdminController {
    constructor(private readonly residentUnits: ResidentUnitsService) {}

    @Patch(':id')
    @AllowedRoles([Role.SUPER_ADMIN])
    @ApiOperation({
        summary:
            'Repair a unit flat key [SUPER_ADMIN] (400 unknown flat, 409 already owned or reserved)',
    })
    @DocResponse({
        serialization: ResidentUnitDto,
        httpStatus: HttpStatus.OK,
        messageKey: 'unit.success.keyUpdated',
    })
    updateKey(
        @Param('id') id: string,
        @Body() dto: ResidentUnitKeyUpdateDto,
        @AuthUser() actor: IAuthUser
    ): Promise<ResidentUnitDto> {
        return this.residentUnits.updateKey(id, dto, actor);
    }
}

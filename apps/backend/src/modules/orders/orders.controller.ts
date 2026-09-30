import {
    Body,
    Controller,
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

import { AllowedRoles } from 'src/common/request/decorators/request.role.decorator';
import { AuthUser } from 'src/common/request/decorators/request.user.decorator';
import { IAuthUser } from 'src/common/request/interfaces/request.interface';

import { OrderCreateDto } from './dtos/request/order.create.dto';
import { OrderQueryDto } from './dtos/request/order.query.dto';
import { OrderUpdateStatusDto } from './dtos/request/order.update-status.dto';
import {
    OrderListResponseDto,
    OrderResponseDto,
} from './dtos/response/order.response.dto';
import { OrdersService } from './orders.service';

@ApiTags('orders')
@ApiBearerAuth('accessToken')
@Controller({ path: '/orders', version: '1' })
export class OrdersController {
    constructor(private readonly ordersService: OrdersService) {}

    @Post()
    @AllowedRoles([Role.RESIDENT])
    @ApiOperation({ summary: 'Place a new order [RESIDENT]' })
    create(
        @Body() dto: OrderCreateDto,
        @AuthUser() actor: IAuthUser
    ): Promise<OrderResponseDto> {
        return this.ordersService.create(dto, actor);
    }

    @Get()
    @AllowedRoles([Role.RESIDENT, Role.MERCHANT, Role.ADMIN])
    @ApiOperation({
        summary: 'List orders (filtered by role) [RESIDENT/MERCHANT/ADMIN]',
    })
    list(
        @Query() query: OrderQueryDto,
        @AuthUser() actor: IAuthUser
    ): Promise<OrderListResponseDto> {
        return this.ordersService.findAll(query, actor);
    }

    @Get(':id')
    @AllowedRoles([Role.RESIDENT, Role.MERCHANT, Role.ADMIN])
    @ApiOperation({
        summary: 'Get order by id [RESIDENT(own)/MERCHANT(shop)/ADMIN]',
    })
    findOne(
        @Param('id') id: string,
        @AuthUser() actor: IAuthUser
    ): Promise<OrderResponseDto> {
        return this.ordersService.findOne(id, actor);
    }

    @Patch(':id/status')
    @AllowedRoles([Role.MERCHANT, Role.ADMIN])
    @ApiOperation({ summary: 'Update order status [MERCHANT(own shop)/ADMIN]' })
    updateStatus(
        @Param('id') id: string,
        @Body() dto: OrderUpdateStatusDto,
        @AuthUser() actor: IAuthUser
    ): Promise<OrderResponseDto> {
        return this.ordersService.updateStatus(id, dto, actor);
    }

    @Patch(':id/cancel')
    @AllowedRoles([Role.RESIDENT])
    @HttpCode(HttpStatus.OK)
    @ApiOperation({ summary: 'Cancel order (PLACED status only) [RESIDENT]' })
    cancel(
        @Param('id') id: string,
        @AuthUser() actor: IAuthUser
    ): Promise<OrderResponseDto> {
        return this.ordersService.cancel(id, actor);
    }
}

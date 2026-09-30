import { Logger } from '@nestjs/common';
import {
    ConnectedSocket,
    MessageBody,
    OnGatewayConnection,
    OnGatewayDisconnect,
    SubscribeMessage,
    WebSocketGateway,
    WebSocketServer,
} from '@nestjs/websockets';
import { OrderStatus } from '@prisma/client';
import { Server, Socket } from 'socket.io';

@WebSocketGateway({
    namespace: '/orders',
    cors: { origin: '*', credentials: true },
    transports: ['websocket', 'polling'],
})
export class OrdersGateway implements OnGatewayConnection, OnGatewayDisconnect {
    @WebSocketServer() server: Server;
    private readonly logger = new Logger(OrdersGateway.name);

    handleConnection(client: Socket): void {
        this.logger.debug(`Client connected: ${client.id}`);
    }

    handleDisconnect(client: Socket): void {
        this.logger.debug(`Client disconnected: ${client.id}`);
    }

    /** Client calls this to subscribe to a specific order's updates */
    @SubscribeMessage('order:join')
    async handleJoinOrder(
        @ConnectedSocket() client: Socket,
        @MessageBody() orderId: string
    ): Promise<void> {
        await client.join(`order:${orderId}`);
        this.logger.debug(`${client.id} joined room order:${orderId}`);
    }

    @SubscribeMessage('order:leave')
    async handleLeaveOrder(
        @ConnectedSocket() client: Socket,
        @MessageBody() orderId: string
    ): Promise<void> {
        await client.leave(`order:${orderId}`);
    }

    /** Called by OrdersService when status changes */
    emitStatusUpdate(orderId: string, status: OrderStatus): void {
        this.server.to(`order:${orderId}`).emit('order:status_update', {
            orderId,
            status,
            timestamp: new Date().toISOString(),
        });
    }
}

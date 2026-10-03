import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
    ConnectedSocket,
    MessageBody,
    OnGatewayConnection,
    OnGatewayDisconnect,
    SubscribeMessage,
    WebSocketGateway,
    WebSocketServer,
    WsException,
} from '@nestjs/websockets';
import { OrderStatus, Role } from '@prisma/client';
import { verify } from 'jsonwebtoken';
import { Server, Socket } from 'socket.io';

import { SessionVersionService } from 'src/common/auth/services/session-version.service';
import appConfig from 'src/common/config/app.config';
import { DatabaseService } from 'src/common/database/services/database.service';
import { IJwtClaims } from 'src/common/helper/interfaces/encryption.interface';
import { IAuthUser } from 'src/common/request/interfaces/request.interface';

/** Same allow-list the HTTP layer uses (app.cors.origin / APP_CORS_ORIGINS) */
const corsOrigin = (appConfig() as { cors: { origin: boolean | string[] } })
    .cors.origin;

@WebSocketGateway({
    namespace: '/orders',
    cors: { origin: corsOrigin, credentials: true },
    transports: ['websocket', 'polling'],
})
export class OrdersGateway implements OnGatewayConnection, OnGatewayDisconnect {
    @WebSocketServer() server: Server;
    private readonly logger = new Logger(OrdersGateway.name);

    constructor(
        private readonly config: ConfigService,
        private readonly db: DatabaseService,
        private readonly sessions: SessionVersionService
    ) {}

    /** Token from handshake.auth.token, falling back to the Authorization header */
    private extractToken(client: Socket): string | null {
        const authToken: unknown = client.handshake.auth?.['token'];
        if (typeof authToken === 'string' && authToken.length > 0) {
            return authToken.replace(/^Bearer\s+/i, '');
        }
        const header = client.handshake.headers?.authorization;
        if (typeof header === 'string') {
            const match = /^Bearer\s+(\S+)/i.exec(header);
            if (match) return match[1] ?? null;
        }
        return null;
    }

    async handleConnection(client: Socket): Promise<void> {
        const token = this.extractToken(client);
        try {
            if (!token) throw new Error('missing token');
            const payload = verify(
                token,
                this.config.getOrThrow<string>('auth.accessToken.secret')
            ) as Partial<IJwtClaims>;
            if (!payload.userId || !payload.role) {
                throw new Error('invalid payload');
            }
            // Same revocation rule as HTTP: tokens issued before a password
            // reset or account deletion are refused.
            await this.sessions.assertCurrent({
                userId: payload.userId,
                ver: payload.ver,
            });
            client.data.user = {
                userId: payload.userId,
                role: payload.role,
            } as IAuthUser;
            this.logger.debug(`Client connected: ${client.id}`);
        } catch {
            this.logger.debug(`Rejected unauthenticated client: ${client.id}`);
            client.disconnect(true);
        }
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
        const user = client.data?.user as IAuthUser | undefined;
        if (!user || typeof orderId !== 'string' || orderId.length === 0) {
            throw new WsException('forbidden');
        }

        if (user.role !== Role.ADMIN) {
            const order = await this.db.order.findUnique({
                where: { id: orderId },
                select: {
                    residentId: true,
                    shop: { select: { merchantId: true } },
                },
            });
            const allowed =
                !!order &&
                (order.residentId === user.userId ||
                    order.shop.merchantId === user.userId);
            if (!allowed) throw new WsException('forbidden');
        }

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

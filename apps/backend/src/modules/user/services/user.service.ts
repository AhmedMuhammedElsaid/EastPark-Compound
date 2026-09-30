import {
    HttpException,
    HttpStatus,
    Injectable,
    NotFoundException,
} from '@nestjs/common';

import { DatabaseService } from 'src/common/database/services/database.service';
import { ApiGenericResponseDto } from 'src/common/response/dtos/response.generic.dto';

import { UserUpdateDto } from '../dtos/request/user.update.request';
import {
    UserGetProfileResponseDto,
    UserUpdateProfileResponseDto,
} from '../dtos/response/user.response';

@Injectable()
export class UserService {
    constructor(private readonly db: DatabaseService) {}

    async getProfile(userId: string): Promise<UserGetProfileResponseDto> {
        const user = await this.db.user.findUnique({ where: { id: userId } });
        if (!user) throw new NotFoundException('User not found');
        return user;
    }

    async updateUser(
        userId: string,
        data: UserUpdateDto
    ): Promise<UserUpdateProfileResponseDto> {
        const user = await this.db.user.findUnique({ where: { id: userId } });
        if (!user) throw new NotFoundException('User not found');

        return this.db.user.update({ where: { id: userId }, data });
    }

    async deleteUser(userId: string): Promise<ApiGenericResponseDto> {
        const user = await this.db.user.findUnique({ where: { id: userId } });
        if (!user) throw new NotFoundException('User not found');

        // Cascade delete in an interactive transaction to allow sequential logic
        await this.db.$transaction(async tx => {
            // 1. Personal data
            await tx.notificationPreference.deleteMany({ where: { userId } });
            await tx.notification.deleteMany({ where: { userId } });
            await tx.auditLog.deleteMany({ where: { userId } });
            await tx.feedbackReply.deleteMany({ where: { authorId: userId } });
            await tx.feedback.deleteMany({ where: { userId } });
            await tx.comment.deleteMany({ where: { userId } });
            await tx.electionVote.deleteMany({ where: { userId } });
            await tx.vote.deleteMany({ where: { userId } });
            await tx.review.deleteMany({ where: { userId } });
            await tx.savedShop.deleteMany({ where: { userId } });

            // 2. Orders placed by this resident
            await tx.orderItem.deleteMany({ where: { order: { residentId: userId } } });
            await tx.order.deleteMany({ where: { residentId: userId } });

            // 3. Merchant's shops and all shop-related data
            const ownedShops = await tx.shop.findMany({
                where: { merchantId: userId },
                select: { id: true },
            });
            if (ownedShops.length > 0) {
                const shopIds = ownedShops.map(s => s.id);
                // Delete orders in merchant's shops (items first, then orders)
                await tx.orderItem.deleteMany({ where: { order: { shopId: { in: shopIds } } } });
                await tx.order.deleteMany({ where: { shopId: { in: shopIds } } });
                // Delete reviews and saved-shops pointing to these shops
                await tx.review.deleteMany({ where: { shopId: { in: shopIds } } });
                await tx.savedShop.deleteMany({ where: { shopId: { in: shopIds } } });
                // Delete products and photos (shopPhoto has onDelete: Cascade but being explicit)
                await tx.product.deleteMany({ where: { shopId: { in: shopIds } } });
                await tx.shopPhoto.deleteMany({ where: { shopId: { in: shopIds } } });
                await tx.shop.deleteMany({ where: { merchantId: userId } });
            }

            // 4. Invitations sent by this user
            await tx.invitation.deleteMany({ where: { invitedById: userId } });

            // 5. Finally delete the user
            await tx.user.delete({ where: { id: userId } });
        });

        return { success: true, message: 'User deleted' };
    }

    async deleteAccount(userId: string): Promise<void> {
        await this.deleteUser(userId);
    }
}

import {
    ConflictException,
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

    /**
     * Deletes a user and their personal data (self-delete and admin delete).
     *
     * A merchant that still owns a shop is refused with 409: the shop's orders are
     * other residents' order history and financial records, so they must never be
     * wiped as a side effect of closing an account. The database FKs (orders -> shops,
     * shops -> users) are ON DELETE RESTRICT for the same reason. The shop has to be
     * removed or reassigned first through the shops module, which itself refuses
     * while orders or products still reference it.
     */
    async deleteUser(userId: string): Promise<ApiGenericResponseDto> {
        const user = await this.db.user.findUnique({ where: { id: userId } });
        if (!user) throw new NotFoundException('User not found');

        const ownedShops = await this.db.shop.count({
            where: { merchantId: userId },
        });
        if (ownedShops > 0) {
            throw new ConflictException('user.error.merchantOwnsShop');
        }

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

            // 3. Invitations sent by this user
            await tx.invitation.deleteMany({ where: { invitedById: userId } });

            // 4. Finally delete the user
            await tx.user.delete({ where: { id: userId } });
        });

        return { success: true, message: 'User deleted' };
    }

    async deleteAccount(userId: string): Promise<void> {
        await this.deleteUser(userId);
    }
}

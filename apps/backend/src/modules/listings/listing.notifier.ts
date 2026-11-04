import { Injectable, Logger } from '@nestjs/common';
import { NotificationType } from '@prisma/client';

import { NotificationsService } from 'src/modules/notifications/notifications.service';

export type ListingNotifyEvent = 'APPROVED' | 'REJECTED' | 'EXPIRED';

const COPY: Record<
    ListingNotifyEvent,
    { title: string; titleAr: string; body: string; bodyAr: string }
> = {
    APPROVED: {
        title: 'Your listing was approved',
        titleAr: 'تمت الموافقة على إعلانك',
        body: 'Your listing for flat {unit} is now visible to residents.',
        bodyAr: 'إعلانك عن الوحدة {unit} أصبح ظاهرًا للسكان.',
    },
    REJECTED: {
        title: 'Your listing needs changes',
        titleAr: 'إعلانك يحتاج إلى تعديل',
        body: 'Your listing for flat {unit} was not approved. Open it to see the reason.',
        bodyAr: 'لم تتم الموافقة على إعلانك عن الوحدة {unit}. افتحه لمعرفة السبب.',
    },
    EXPIRED: {
        title: 'Your listing expired',
        titleAr: 'انتهت مدة إعلانك',
        body: 'Your listing for flat {unit} has expired. You can create a new one.',
        bodyAr: 'انتهت مدة إعلانك عن الوحدة {unit}. يمكنك إنشاء إعلان جديد.',
    },
};

/**
 * Best-effort `LISTING_UPDATE` notifications. A failure is logged and
 * swallowed: it must never roll back or fail the status change it describes.
 */
@Injectable()
export class ListingNotifier {
    private readonly logger = new Logger(ListingNotifier.name);

    constructor(private readonly notifications: NotificationsService) {}

    async notify(
        event: ListingNotifyEvent,
        ownerId: string,
        listingId: string,
        unitLabel: string
    ): Promise<void> {
        const copy = COPY[event];
        try {
            await this.notifications.send(
                ownerId,
                NotificationType.LISTING_UPDATE,
                copy.title,
                copy.titleAr,
                copy.body.replace('{unit}', unitLabel),
                copy.bodyAr.replace('{unit}', unitLabel),
                { type: 'LISTING_UPDATE', listingId, status: event }
            );
        } catch (error) {
            const reason =
                error instanceof Error ? error.message : String(error);
            this.logger.error(
                `Listing notification failed (${event} ${listingId}): ${reason}`
            );
        }
    }
}

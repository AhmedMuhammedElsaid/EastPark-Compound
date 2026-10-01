import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { TerminusModule } from '@nestjs/terminus';

import { CommonModule } from 'src/common/common.module';
import { AnnouncementsModule } from 'src/modules/announcements/announcements.module';
import { InvitationsModule } from 'src/modules/invitations/invitations.module';
import { FeedbackModule } from 'src/modules/feedback/feedback.module';
import { GovernanceModule } from 'src/modules/governance/governance.module';
import { MerchantModule } from 'src/modules/merchant/merchant.module';
import { OrdersModule } from 'src/modules/orders/orders.module';
import { NotificationsModule } from 'src/modules/notifications/notifications.module';
import { PaymentsModule } from 'src/modules/payments/payments.module';
import { ProductsModule } from 'src/modules/products/products.module';
import { ReportsModule } from 'src/modules/reports/reports.module';
import { ResidentsModule } from 'src/modules/residents/residents.module';
import { ShopsModule } from 'src/modules/shops/shops.module';
import { SupportModule } from 'src/modules/support/support.module';
import { UploadsModule } from 'src/modules/uploads/uploads.module';
import { UserModule } from 'src/modules/user/user.module';

import { HealthController } from './controllers/health.controller';

@Module({
    imports: [
        // Shared infrastructure (config, db, auth, cache, email, file, logger)
        CommonModule,

        // Health check endpoint
        TerminusModule,

        // Cron scheduler
        ScheduleModule.forRoot(),

        // Feature modules — Phase 3: Core APIs
        UserModule,
        ShopsModule,
        ProductsModule,
        OrdersModule,
        MerchantModule,
        UploadsModule,

        // Feature modules — Phase 4: Community Hub
        AnnouncementsModule,
        ReportsModule,
        FeedbackModule,

        // Feature modules — Phase 5: Governance
        GovernanceModule,

        // Feature modules — Phase 6: Payments
        PaymentsModule,

        // Feature modules — Phase 7: Notifications
        NotificationsModule,

        // Phase 8: Admin tools
        InvitationsModule,
        ResidentsModule,
        SupportModule,
    ],
    controllers: [HealthController],
})
export class AppModule {}

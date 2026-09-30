import type { Metadata } from 'next';
import { redirect } from 'next/navigation';

import { NotificationCenter } from '@/components/app/NotificationCenter';
import { AuthenticatedRequestError } from '@/lib/api/authenticated.server';
import type { NotificationPage, NotificationPreference } from '@/lib/api/notifications';
import {
  getNotificationPreferences,
  getNotifications,
} from '@/lib/api/notifications.server';

export const metadata: Metadata = { title: 'Notifications' };
export const dynamic = 'force-dynamic';

export default async function NotificationsPage() {
  let initialPage: NotificationPage | null = null;
  let initialPreferences: NotificationPreference[] | null = null;

  try {
    [initialPage, initialPreferences] = await Promise.all([
      getNotifications(),
      getNotificationPreferences(),
    ]);
  } catch (error) {
    if (error instanceof AuthenticatedRequestError && error.status === 401) {
      redirect('/login?next=/notifications');
    }

    console.error('Notifications page failed', error);
  }

  return (
    <NotificationCenter
      initialPage={initialPage}
      initialPreferences={initialPreferences}
    />
  );
}
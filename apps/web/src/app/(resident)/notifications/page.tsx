import type { Metadata } from 'next';
import { redirect } from 'next/navigation';

import { NotificationCenter } from '@/components/app/NotificationCenter';
import { AuthenticatedRequestError, RENDER_SESSION } from '@/lib/api/authenticated.server';
import type { NotificationPage, NotificationPreference } from '@/lib/api/notifications';
import {
  getNotificationPreferences,
  getNotifications,
} from '@/lib/api/notifications.server';
import { loginPath, sessionRefreshPath } from '@/lib/auth/return-path';

export const metadata: Metadata = { title: 'الإشعارات' };
export const dynamic = 'force-dynamic';

const PAGE_PATH = '/notifications';

export default async function NotificationsPage() {
  let initialPage: NotificationPage | null = null;
  let initialPreferences: NotificationPreference[] | null = null;
  let redirectTo: string | null = null;

  try {
    [initialPage, initialPreferences] = await Promise.all([
      getNotifications({}, RENDER_SESSION),
      getNotificationPreferences(RENDER_SESSION),
    ]);
  } catch (error) {
    if (error instanceof AuthenticatedRequestError && error.status === 401) {
      redirectTo = error.refreshRequired ? sessionRefreshPath(PAGE_PATH) : loginPath(PAGE_PATH);
    } else {
      console.error('Notifications page failed', error);
    }
  }

  // Outside the try block so Next's redirect signal is never swallowed.
  if (redirectTo) redirect(redirectTo);

  return (
    <NotificationCenter
      initialPage={initialPage}
      initialPreferences={initialPreferences}
    />
  );
}

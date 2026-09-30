import 'server-only';

import {
  parseNotificationPage,
  parseNotificationPreferences,
  type NotificationPage,
  type NotificationPreference,
} from '@/lib/api/notifications';
import { authenticatedBackendFetch, AuthenticatedRequestError } from './authenticated.server';

export { AuthenticatedRequestError };

export async function getNotifications(options: {
  cursor?: string;
  isRead?: boolean;
  limit?: number;
} = {}): Promise<NotificationPage> {
  const params = new URLSearchParams();
  params.set('limit', String(options.limit ?? 20));
  if (options.cursor) params.set('cursor', options.cursor);
  if (options.isRead !== undefined) params.set('isRead', String(options.isRead));

  const response = await authenticatedBackendFetch(`/notifications?${params.toString()}`);
  if (!response.ok) {
    throw new AuthenticatedRequestError('Notifications request failed', response.status);
  }

  return parseNotificationPage(await response.json());
}

export async function getNotificationPreferences(): Promise<NotificationPreference[]> {
  const response = await authenticatedBackendFetch('/notifications/preferences');
  if (!response.ok) {
    throw new AuthenticatedRequestError('Notification preferences request failed', response.status);
  }

  return parseNotificationPreferences(await response.json());
}
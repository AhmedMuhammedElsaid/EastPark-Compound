import 'server-only';

import type {
  AnnouncementCategory,
  AnnouncementDetail,
  AnnouncementPage,
} from '@/lib/api/announcements';
import { parseAnnouncementDetail, parseAnnouncementPage } from '@/lib/api/announcements';
import { backendFetch } from '@/lib/auth/server';

type AnnouncementQuery = {
  category?: AnnouncementCategory;
  cursor?: string;
};

export class AnnouncementRequestError extends Error {
  constructor(public readonly status: number) {
    super(`Announcement request failed with ${status}`);
  }
}

async function fetchWithTransportRetry(path: string): Promise<Response> {
  try {
    return await backendFetch(path);
  } catch {
    return backendFetch(path);
  }
}

export async function getAnnouncements(query: AnnouncementQuery = {}): Promise<AnnouncementPage> {
  const params = new URLSearchParams({ limit: '12' });
  if (query.category) params.set('category', query.category);
  if (query.cursor) params.set('cursor', query.cursor);

  const path = `/announcements?${params.toString()}`;
  const response = await fetchWithTransportRetry(path);
  if (!response.ok) throw new Error(`Announcements request failed with ${response.status}`);

  return parseAnnouncementPage(await response.json());
}

export async function getAnnouncementDetail(id: string): Promise<AnnouncementDetail> {
  const response = await fetchWithTransportRetry(`/announcements/${encodeURIComponent(id)}`);
  if (!response.ok) throw new AnnouncementRequestError(response.status);

  return parseAnnouncementDetail(await response.json());
}
import 'server-only';

import type { Report, ReportPage } from '@/lib/api/reports';
import { parseReport, parseReportPage } from '@/lib/api/reports';
import { backendFetch } from '@/lib/auth/server';

export class ReportRequestError extends Error {
  constructor(public readonly status: number) {
    super(`Report request failed with ${status}`);
  }
}

async function fetchWithTransportRetry(path: string): Promise<Response> {
  try {
    return await backendFetch(path);
  } catch {
    return backendFetch(path);
  }
}

export async function getReports(cursor?: string): Promise<ReportPage> {
  const params = new URLSearchParams({ limit: '20' });
  if (cursor) params.set('cursor', cursor);

  const response = await fetchWithTransportRetry(`/reports?${params.toString()}`);
  if (!response.ok) throw new ReportRequestError(response.status);

  return parseReportPage(await response.json());
}

export async function getReport(id: string): Promise<Report> {
  const response = await fetchWithTransportRetry(`/reports/${encodeURIComponent(id)}`);
  if (!response.ok) throw new ReportRequestError(response.status);

  return parseReport(await response.json());
}
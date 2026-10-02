import 'server-only';

import type { Report, ReportPage } from '@/lib/api/reports';
import { parseReport, parseReportPage } from '@/lib/api/reports';
import { backendFetch, type BackendContext } from '@/lib/auth/server';

export class ReportRequestError extends Error {
  constructor(public readonly status: number) {
    super(`Report request failed with ${status}`);
  }
}

async function fetchWithTransportRetry(path: string, context: BackendContext): Promise<Response> {
  try {
    return await backendFetch(path, {}, context);
  } catch {
    return backendFetch(path, {}, context);
  }
}

export async function getReports(cursor?: string, context: BackendContext = {}): Promise<ReportPage> {
  const params = new URLSearchParams({ limit: '20' });
  if (cursor) params.set('cursor', cursor);

  const response = await fetchWithTransportRetry(`/reports?${params.toString()}`, context);
  if (!response.ok) throw new ReportRequestError(response.status);

  return parseReportPage(await response.json());
}

export async function getReport(id: string, context: BackendContext = {}): Promise<Report> {
  const response = await fetchWithTransportRetry(`/reports/${encodeURIComponent(id)}`, context);
  if (!response.ok) throw new ReportRequestError(response.status);

  return parseReport(await response.json());
}
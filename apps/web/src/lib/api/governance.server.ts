import 'server-only';

import type { Election, ElectionPage, Poll, PollPage } from '@/lib/api/governance';
import {
  parseElection,
  parseElectionPage,
  parsePoll,
  parsePollPage,
} from '@/lib/api/governance';
import {
  authCookies,
  backendFetch,
  bearer,
  refreshAuthTokens,
} from '@/lib/auth/server';
import { z } from 'zod';

export class GovernanceRequestError extends Error {
  constructor(public readonly status: number) {
    super(`Governance request failed with ${status}`);
  }
}

async function governanceFetch(path: string, includeSession = false): Promise<Response> {
  const tokens = includeSession ? await authCookies() : {};
  let accessToken = tokens.accessToken;

  let response = await fetchWithTransportRetry(path, accessToken);
  if (response.status === 401 && tokens.refreshToken) {
    accessToken = (await refreshAuthTokens(tokens.refreshToken))?.accessToken;
    response = await fetchWithTransportRetry(path, accessToken);
  }

  // Reads are public. A stale session must not make governance unavailable.
  if (response.status === 401 && accessToken) return fetchWithTransportRetry(path);
  return response;
}

async function fetchWithTransportRetry(path: string, accessToken?: string): Promise<Response> {
  const init = accessToken ? { headers: bearer(accessToken) } : undefined;
  try {
    return await backendFetch(path, init);
  } catch {
    return backendFetch(path, init);
  }
}

export async function getPolls(cursor?: string, includeSession = false): Promise<PollPage> {
  const params = new URLSearchParams({ limit: '12' });
  if (cursor) params.set('cursor', cursor);
  const response = await governanceFetch(`/polls?${params.toString()}`, includeSession);
  if (!response.ok) throw new GovernanceRequestError(response.status);
  return parsePollPage(await response.json());
}

export async function getPoll(id: string, includeSession = false): Promise<Poll> {
  const response = await governanceFetch(`/polls/${encodeURIComponent(id)}`, includeSession);
  if (!response.ok) throw new GovernanceRequestError(response.status);
  return parsePoll(await response.json());
}

export async function getElections(cursor?: string, includeSession = false): Promise<ElectionPage> {
  const params = new URLSearchParams({ limit: '12' });
  if (cursor) params.set('cursor', cursor);
  const response = await governanceFetch(`/elections?${params.toString()}`, includeSession);
  if (!response.ok) throw new GovernanceRequestError(response.status);
  return parseElectionPage(await response.json());
}

export async function getElection(id: string, includeSession = false): Promise<Election> {
  const response = await governanceFetch(`/elections/${encodeURIComponent(id)}`, includeSession);
  if (!response.ok) throw new GovernanceRequestError(response.status);
  return parseElection(await response.json());
}

export class GovernanceVoteError extends Error {
  constructor(public readonly status: number) {
    super(`Governance vote failed with ${status}`);
  }
}

const profileEnvelopeSchema = z.object({
  data: z.object({ role: z.enum(['GUEST', 'RESIDENT', 'MERCHANT', 'ADMIN']) }),
});

async function residentAccessToken(): Promise<string> {
  const tokens = await authCookies();
  let accessToken = tokens.accessToken;

  if (!accessToken && tokens.refreshToken) {
    accessToken = (await refreshAuthTokens(tokens.refreshToken))?.accessToken;
  }
  if (!accessToken) throw new GovernanceVoteError(401);

  let profileResponse = await backendFetch('/user/profile', { headers: bearer(accessToken) });
  if (profileResponse.status === 401 && tokens.refreshToken) {
    const refreshed = await refreshAuthTokens(tokens.refreshToken);
    if (refreshed) {
      accessToken = refreshed.accessToken;
      profileResponse = await backendFetch('/user/profile', { headers: bearer(accessToken) });
    }
  }
  if (!profileResponse.ok) throw new GovernanceVoteError(profileResponse.status === 401 ? 401 : 502);

  const profile = profileEnvelopeSchema.parse(await profileResponse.json()).data;
  if (profile.role !== 'RESIDENT') throw new GovernanceVoteError(403);
  return accessToken;
}

export async function votePoll(id: string, optionId: string): Promise<Poll> {
  const accessToken = await residentAccessToken();
  const response = await backendFetch(`/polls/${encodeURIComponent(id)}/vote`, {
    method: 'POST',
    headers: { ...bearer(accessToken), 'Content-Type': 'application/json' },
    body: JSON.stringify({ optionId }),
  });
  if (!response.ok) throw new GovernanceVoteError(response.status);
  return getPoll(id, true);
}

export async function voteElection(id: string, candidateId: string): Promise<Election> {
  const accessToken = await residentAccessToken();
  const response = await backendFetch(`/elections/${encodeURIComponent(id)}/vote`, {
    method: 'POST',
    headers: { ...bearer(accessToken), 'Content-Type': 'application/json' },
    body: JSON.stringify({ candidateId }),
  });
  if (!response.ok) throw new GovernanceVoteError(response.status);
  return getElection(id, true);
}
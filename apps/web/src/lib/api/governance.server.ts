import 'server-only';

import type { Election, ElectionPage, Poll, PollPage } from '@/lib/api/governance';
import {
  parseElection,
  parseElectionPage,
  parsePoll,
  parsePollPage,
} from '@/lib/api/governance';
import {
  backendFetch,
  bearer,
  getProfile,
  requestClientIp,
  SessionRefreshRequiredError,
  sessionFetch,
  type SessionOptions,
} from '@/lib/auth/server';

export { SessionRefreshRequiredError };

export class GovernanceRequestError extends Error {
  constructor(public readonly status: number) {
    super(`Governance request failed with ${status}`);
  }
}

/**
 * `session` personalises the public read (e.g. `hasVoted`). Route handlers pass
 * `{ mutateCookies: true }`; Server Components pass `{ mutateCookies: false }` and must redirect
 * through `sessionRefreshPath(..., { optional: true })` on `SessionRefreshRequiredError`.
 * Omit it for a purely anonymous read.
 */
export type GovernanceReadOptions = { session?: SessionOptions; clientIp?: string | null };

async function governanceFetch(path: string, options: GovernanceReadOptions = {}): Promise<Response> {
  if (!options.session) {
    return withTransportRetry(() => backendFetch(path, {}, { clientIp: options.clientIp }));
  }

  // Session reads are request-bound (they read cookies), so the client IP can come from headers().
  const clientIp = options.clientIp ?? options.session.clientIp ?? (await requestClientIp());
  const result = await withTransportRetry(() => sessionFetch(path, {}, { ...options.session!, clientIp }));
  if (result.status === 'ok') return result.response;
  if (result.status === 'refresh-required') throw new SessionRefreshRequiredError();
  // Reads are public. A stale session must not make governance unavailable.
  return withTransportRetry(() => backendFetch(path, {}, { clientIp }));
}

async function withTransportRetry<T>(request: () => Promise<T>): Promise<T> {
  try {
    return await request();
  } catch {
    return request();
  }
}

export async function getPolls(cursor?: string, options: GovernanceReadOptions = {}): Promise<PollPage> {
  const params = new URLSearchParams({ limit: '12' });
  if (cursor) params.set('cursor', cursor);
  const response = await governanceFetch(`/polls?${params.toString()}`, options);
  if (!response.ok) throw new GovernanceRequestError(response.status);
  return parsePollPage(await response.json());
}

export async function getPoll(id: string, options: GovernanceReadOptions = {}): Promise<Poll> {
  const response = await governanceFetch(`/polls/${encodeURIComponent(id)}`, options);
  if (!response.ok) throw new GovernanceRequestError(response.status);
  return parsePoll(await response.json());
}

export async function getElections(cursor?: string, options: GovernanceReadOptions = {}): Promise<ElectionPage> {
  const params = new URLSearchParams({ limit: '12' });
  if (cursor) params.set('cursor', cursor);
  const response = await governanceFetch(`/elections?${params.toString()}`, options);
  if (!response.ok) throw new GovernanceRequestError(response.status);
  return parseElectionPage(await response.json());
}

export async function getElection(id: string, options: GovernanceReadOptions = {}): Promise<Election> {
  const response = await governanceFetch(`/elections/${encodeURIComponent(id)}`, options);
  if (!response.ok) throw new GovernanceRequestError(response.status);
  return parseElection(await response.json());
}

export class GovernanceVoteError extends Error {
  constructor(public readonly status: number) {
    super(`Governance vote failed with ${status}`);
  }
}

const ROUTE_SESSION: SessionOptions = { mutateCookies: true };

/** Route handlers only: refreshes cookies when needed and requires a RESIDENT profile. */
async function residentAccessToken(): Promise<string> {
  const profile = await getProfile(ROUTE_SESSION);
  if (profile.status === 'unavailable') throw new GovernanceVoteError(502);
  if (profile.status === 'rate_limited') throw new GovernanceVoteError(429);
  if (profile.status !== 'authenticated') throw new GovernanceVoteError(401);
  if (profile.user.role !== 'RESIDENT') throw new GovernanceVoteError(403);
  return profile.accessToken;
}

async function castVote(path: string, body: unknown): Promise<void> {
  const accessToken = await residentAccessToken();
  const response = await backendFetch(
    path,
    {
      method: 'POST',
      headers: { ...bearer(accessToken), 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    },
    { clientIp: await requestClientIp() },
  );
  if (!response.ok) throw new GovernanceVoteError(response.status);
}

export async function votePoll(id: string, optionId: string): Promise<Poll> {
  await castVote(`/polls/${encodeURIComponent(id)}/vote`, { optionId });
  return getPoll(id, { session: ROUTE_SESSION });
}

export async function voteElection(id: string, candidateId: string): Promise<Election> {
  await castVote(`/elections/${encodeURIComponent(id)}/vote`, { candidateId });
  return getElection(id, { session: ROUTE_SESSION });
}

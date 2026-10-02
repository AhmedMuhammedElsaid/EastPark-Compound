import type { AxiosResponse } from "axios";

import { client } from "./client";

export type ElectionVisibilityMode = "SEALED_UNTIL_DEADLINE" | "LIVE_COUNT" | "ADMIN_CONTROLLED";

// ─── Raw backend shapes (PollResponseDto / ElectionResponseDto) ───────────────

export type PollOptionResponse = {
  id: string;
  label: string;
  labelAr: string;
  /** Only present once the poll has expired. */
  voteCount?: number;
};

export type PollResponse = {
  id: string;
  question: string;
  questionAr: string;
  expiresAt: string;
  createdAt: string;
  options: PollOptionResponse[];
  /** Populated when a valid access token is sent. */
  myVoteOptionId?: string | null;
};

export type CandidateResponse = {
  id: string;
  name: string;
  nameAr: string;
  statement?: string | null;
  statementAr?: string | null;
  photoUrl?: string | null;
  /** Only present when results are visible (resultsOpen or LIVE_COUNT). */
  voteCount?: number;
};

export type ElectionResponse = {
  id: string;
  title: string;
  titleAr: string;
  description?: string | null;
  descriptionAr?: string | null;
  expiresAt: string;
  resultsOpen: boolean;
  visibilityMode: ElectionVisibilityMode;
  createdAt: string;
  candidates: CandidateResponse[];
  myVoteCandidateId?: string | null;
};

// ─── Normalized view models used by screens ───────────────────────────────────

export type PollOption = PollOptionResponse;

export type Poll = Omit<PollResponse, "myVoteOptionId"> & {
  myVoteOptionId: string | null;
  /** True when the backend included vote counts. */
  resultsVisible: boolean;
  /** Sum of option counts; null while counts are hidden. */
  totalVotes: number | null;
  isExpired: boolean;
};

export type Candidate = {
  id: string;
  name: string;
  nameAr: string;
  statement: string | null;
  statementAr: string | null;
  photoUrl: string | null;
  voteCount?: number;
};

export type Election = Omit<ElectionResponse, "candidates" | "myVoteCandidateId" | "description" | "descriptionAr"> & {
  description: string | null;
  descriptionAr: string | null;
  candidates: Candidate[];
  myVoteCandidateId: string | null;
  resultsVisible: boolean;
  totalVotes: number | null;
  isExpired: boolean;
};

function sumCounts(entries: Array<{ voteCount?: number }>): { visible: boolean; total: number | null } {
  const visible = entries.some(e => typeof e.voteCount === "number");
  if (!visible)
    return { visible, total: null };
  return { visible, total: entries.reduce((sum, e) => sum + (e.voteCount ?? 0), 0) };
}

function isPast(iso: string, now: number): boolean {
  const ts = new Date(iso).getTime();
  return Number.isFinite(ts) && ts <= now;
}

export function mapPoll(raw: PollResponse, now: number = Date.now()): Poll {
  const options = raw.options ?? [];
  const { visible, total } = sumCounts(options);
  return {
    ...raw,
    options,
    myVoteOptionId: raw.myVoteOptionId ?? null,
    resultsVisible: visible,
    totalVotes: total,
    isExpired: isPast(raw.expiresAt, now),
  };
}

export function mapElection(raw: ElectionResponse, now: number = Date.now()): Election {
  const candidates: Candidate[] = (raw.candidates ?? []).map(c => ({
    id: c.id,
    name: c.name,
    nameAr: c.nameAr,
    statement: c.statement ?? null,
    statementAr: c.statementAr ?? null,
    photoUrl: c.photoUrl ?? null,
    ...(typeof c.voteCount === "number" ? { voteCount: c.voteCount } : {}),
  }));
  const { visible, total } = sumCounts(candidates);
  return {
    ...raw,
    description: raw.description ?? null,
    descriptionAr: raw.descriptionAr ?? null,
    candidates,
    myVoteCandidateId: raw.myVoteCandidateId ?? null,
    resultsVisible: visible,
    totalVotes: total,
    isExpired: isPast(raw.expiresAt, now),
  };
}

/** Percentage of `count` in `total`, 0 when unknown. */
export function votePercent(count: number | undefined, total: number | null): number {
  if (typeof count !== "number" || !total)
    return 0;
  return Math.round((count / total) * 100);
}

type Page<T> = { items: T[]; nextCursor: string | null };

function mapResponse<R, T>(res: AxiosResponse<{ data: R }>, map: (raw: R) => T): AxiosResponse<{ data: T }> {
  return { ...res, data: { ...res.data, data: map(res.data.data) } };
}

export type PollCreatePayload = {
  question: string;
  questionAr: string;
  options: Array<{ label: string; labelAr: string }>;
  expiresAt: string;
};

export const governanceApi = {
  // Polls
  getPolls: async (params?: { cursor?: string; limit?: number }) =>
    mapResponse(
      await client.get<{ data: Page<PollResponse> }>("/polls", { params }),
      page => ({ ...page, items: page.items.map(p => mapPoll(p)) }),
    ),

  getPoll: async (pollId: string) =>
    mapResponse(await client.get<{ data: PollResponse }>(`/polls/${pollId}`), p => mapPoll(p)),

  votePoll: (pollId: string, optionId: string) =>
    client.post<{ data: { message: string } }>(`/polls/${pollId}/vote`, { optionId }),

  // Elections
  getElections: async (params?: { cursor?: string; limit?: number }) =>
    mapResponse(
      await client.get<{ data: Page<ElectionResponse> }>("/elections", { params }),
      page => ({ ...page, items: page.items.map(e => mapElection(e)) }),
    ),

  getElection: async (electionId: string) =>
    mapResponse(await client.get<{ data: ElectionResponse }>(`/elections/${electionId}`), e => mapElection(e)),

  voteElection: (electionId: string, candidateId: string) =>
    client.post<{ data: { message: string } }>(`/elections/${electionId}/vote`, { candidateId }),

  // Admin
  createPoll: (data: PollCreatePayload) => client.post<{ data: PollResponse }>("/polls", data),

  createElection: (data: {
    title: string;
    titleAr: string;
    description?: string;
    descriptionAr?: string;
    expiresAt: string;
    visibilityMode: ElectionVisibilityMode;
  }) => client.post<{ data: ElectionResponse }>("/elections", data),
};

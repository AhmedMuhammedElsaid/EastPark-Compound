import { client } from "./client";

export type ElectionVisibilityMode = "SEALED_UNTIL_DEADLINE" | "LIVE_COUNT" | "ADMIN_CONTROLLED";

export type Poll = {
  id: string;
  question: string;
  questionAr: string;
  options: Array<{ id: string; text: string; textAr: string; votes?: number }>;
  totalVotes: number;
  expiresAt: string;
  myVote: string | null;
  resultsOpen: boolean;
};

export type Candidate = {
  id: string;
  name: string;
  nameAr: string;
  statement: string | null;
  statementAr: string | null;
  photoUrl: string | null;
  votes?: number;
};

export type Election = {
  id: string;
  title: string;
  titleAr: string;
  description: string | null;
  descriptionAr: string | null;
  candidates: Candidate[];
  totalVotes: number;
  expiresAt: string;
  resultsOpen: boolean;
  visibilityMode: ElectionVisibilityMode;
  myVote: string | null;
};

export const governanceApi = {
  // Polls
  getPolls: (params?: { cursor?: string; limit?: number }) =>
    client.get<{ data: { items: Poll[]; nextCursor: string | null } }>("/polls", { params }),

  getPoll: (pollId: string) =>
    client.get<{ data: Poll }>(`/polls/${pollId}`),

  votePoll: (pollId: string, optionId: string) =>
    client.post<{ data: Poll }>(`/polls/${pollId}/vote`, { optionId }),

  // Elections
  getElections: (params?: { cursor?: string; limit?: number }) =>
    client.get<{ data: { items: Election[]; nextCursor: string | null } }>("/elections", { params }),

  getElection: (electionId: string) =>
    client.get<{ data: Election }>(`/elections/${electionId}`),

  voteElection: (electionId: string, candidateId: string) =>
    client.post<{ data: Election }>(`/elections/${electionId}/vote`, { candidateId }),

  // Admin
  createPoll: (data: {
    question: string;
    questionAr: string;
    options: Array<{ text: string; textAr: string }>;
    expiresAt: string;
  }) => client.post<{ data: Poll }>("/polls", data),

  createElection: (data: {
    title: string;
    titleAr: string;
    description?: string;
    descriptionAr?: string;
    expiresAt: string;
    visibilityMode: ElectionVisibilityMode;
  }) => client.post<{ data: Election }>("/elections", data),
};

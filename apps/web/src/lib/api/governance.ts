import { z } from 'zod';

export const electionVisibilityModes = [
  'SEALED_UNTIL_DEADLINE',
  'LIVE_COUNT',
  'ADMIN_CONTROLLED',
] as const;

const pollOptionSchema = z.object({
  id: z.string(),
  label: z.string(),
  labelAr: z.string(),
  voteCount: z.number().int().nonnegative().optional(),
});

const pollSchema = z.object({
  id: z.string(),
  question: z.string(),
  questionAr: z.string(),
  expiresAt: z.string(),
  createdAt: z.string(),
  options: z.array(pollOptionSchema),
  myVoteOptionId: z.string().nullable().optional().transform((value) => value ?? null),
});

const candidateSchema = z.object({
  id: z.string(),
  name: z.string(),
  nameAr: z.string(),
  statement: z.string().nullable().optional().transform((value) => value ?? null),
  statementAr: z.string().nullable().optional().transform((value) => value ?? null),
  photoUrl: z.string().nullable().optional().transform((value) => value ?? null),
  voteCount: z.number().int().nonnegative().optional(),
});

const electionSchema = z.object({
  id: z.string(),
  title: z.string(),
  titleAr: z.string(),
  description: z.string().nullable().optional().transform((value) => value ?? null),
  descriptionAr: z.string().nullable().optional().transform((value) => value ?? null),
  expiresAt: z.string(),
  resultsOpen: z.boolean(),
  visibilityMode: z.enum(electionVisibilityModes),
  createdAt: z.string(),
  candidates: z.array(candidateSchema),
  myVoteCandidateId: z.string().nullable().optional().transform((value) => value ?? null),
});

const pollEnvelopeSchema = z.object({ data: pollSchema });
const electionEnvelopeSchema = z.object({ data: electionSchema });
const pollPageEnvelopeSchema = z.object({
  data: z.object({ items: z.array(pollSchema), nextCursor: z.string().nullish() }),
});
const electionPageEnvelopeSchema = z.object({
  data: z.object({ items: z.array(electionSchema), nextCursor: z.string().nullish() }),
});

export type Poll = z.infer<typeof pollSchema>;
export type PollPage = z.infer<typeof pollPageEnvelopeSchema>['data'];
export type Election = z.infer<typeof electionSchema>;
export type ElectionPage = z.infer<typeof electionPageEnvelopeSchema>['data'];

export function parsePoll(payload: unknown): Poll {
  return pollEnvelopeSchema.parse(payload).data;
}

export function parsePollPage(payload: unknown): PollPage {
  return pollPageEnvelopeSchema.parse(payload).data;
}

export function parseElection(payload: unknown): Election {
  return electionEnvelopeSchema.parse(payload).data;
}

export function parseElectionPage(payload: unknown): ElectionPage {
  return electionPageEnvelopeSchema.parse(payload).data;
}

export const pollVoteSchema = z.object({ optionId: z.string().min(1) }).strict();
export const electionVoteSchema = z.object({ candidateId: z.string().min(1) }).strict();
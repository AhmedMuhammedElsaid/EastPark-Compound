import type { ElectionVisibilityMode, PollCreatePayload } from "@/services/api/governance";
import { toExpiryIso } from "@/lib/expiry-date";

/** Trimmed text, or undefined when blank (so the key is left out of the JSON). */
export function optionalText(value: string | undefined): string | undefined {
  const trimmed = value?.trim();
  return trimmed || undefined;
}

export type PollFormValues = {
  question: string;
  questionAr: string;
  options: Array<{ label: string; labelAr: string }>;
  expiresAt: Date;
};

export function buildPollPayload(values: PollFormValues): PollCreatePayload {
  return {
    question: values.question.trim(),
    questionAr: values.questionAr.trim(),
    options: values.options.map(o => ({ label: o.label.trim(), labelAr: o.labelAr.trim() })),
    expiresAt: toExpiryIso(values.expiresAt),
  };
}

export type ElectionFormValues = {
  title: string;
  titleAr: string;
  description?: string;
  descriptionAr?: string;
  expiresAt: Date;
  visibilityMode: ElectionVisibilityMode;
};

export type ElectionCreatePayload = {
  title: string;
  titleAr: string;
  description?: string;
  descriptionAr?: string;
  expiresAt: string;
  visibilityMode: ElectionVisibilityMode;
};

export function buildElectionPayload(values: ElectionFormValues): ElectionCreatePayload {
  const payload: ElectionCreatePayload = {
    title: values.title.trim(),
    titleAr: values.titleAr.trim(),
    expiresAt: toExpiryIso(values.expiresAt),
    visibilityMode: values.visibilityMode,
  };
  const description = optionalText(values.description);
  const descriptionAr = optionalText(values.descriptionAr);
  if (description)
    payload.description = description;
  if (descriptionAr)
    payload.descriptionAr = descriptionAr;
  return payload;
}

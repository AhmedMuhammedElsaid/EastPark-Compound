import type { Election } from "@/services/api/governance";

type ResultsState = Pick<Election, "resultsOpen" | "visibilityMode">;

/**
 * `PATCH /elections/:id/results-open` accepts any election, but only an
 * ADMIN_CONTROLLED one waits for an admin: sealed elections open at the
 * deadline and live-count ones are always visible.
 */
export function canOpenResults(election: ResultsState): boolean {
  return election.visibilityMode === "ADMIN_CONTROLLED" && !election.resultsOpen;
}

/** Translation key describing when residents see the results. */
export function resultsStatusKey(election: ResultsState): string {
  if (election.resultsOpen)
    return "admin.results_published";
  if (election.visibilityMode === "LIVE_COUNT")
    return "admin.results_live";
  if (election.visibilityMode === "SEALED_UNTIL_DEADLINE")
    return "admin.results_at_deadline";
  return "admin.results_sealed_admin";
}

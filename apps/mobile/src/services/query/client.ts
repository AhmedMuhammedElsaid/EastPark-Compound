import type { Query } from "@tanstack/react-query";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { createAsyncStoragePersister } from "@tanstack/query-async-storage-persister";
import { defaultShouldDehydrateQuery, QueryCache, QueryClient } from "@tanstack/react-query";
import Env from "env";

const MAX_QUERY_RETRIES = 2;

/**
 * Retry only transient failures: network errors / timeouts (no response) and
 * 5xx. 4xx responses (validation, auth, not found) never succeed on retry.
 */
export function shouldRetryQuery(failureCount: number, error: unknown): boolean {
  if (failureCount >= MAX_QUERY_RETRIES)
    return false;
  const status = (error as { response?: { status?: number } } | null)?.response?.status;
  if (status === undefined)
    return true;
  return status >= 500;
}

export const queryClient = new QueryClient({
  queryCache: new QueryCache({
    onError: (error, query) => {
      // Only log unexpected server errors (not 4xx client errors)
      const statusCode = (error as { response?: { status?: number } }).response?.status;
      if (!statusCode || statusCode >= 500) {
        console.error("[QueryCache]", query.queryKey, error);
      }
    },
  }),
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5, // 5 minutes
      gcTime: 1000 * 60 * 60, // 1 hour in memory
      retry: shouldRetryQuery,
      refetchOnWindowFocus: false,
    },
    mutations: {
      retry: 0,
    },
  },
});

/**
 * Only public, non-personal data may be written to AsyncStorage (it is not
 * encrypted). Orders, notifications, feedback, merchant and admin data stay
 * in memory only.
 */
export const PERSISTED_QUERY_ROOTS: ReadonlySet<string> = new Set([
  "shops",
  "shop",
  "shop-products",
  "home-shops",
  "announcements",
  "home-announcements",
  "reports",
  "polls",
  "poll",
  "elections",
  "election",
]);

export function isPersistableQueryKey(queryKey: readonly unknown[]): boolean {
  const root = queryKey[0];
  return typeof root === "string" && PERSISTED_QUERY_ROOTS.has(root);
}

export function shouldPersistQuery(query: Query): boolean {
  return defaultShouldDehydrateQuery(query) && isPersistableQueryKey(query.queryKey);
}

/**
 * Personalised fields the backend adds for the signed-in user (poll/election
 * responses). They must never reach unencrypted AsyncStorage; they are reset
 * to null (the "not voted" shape the UI already handles).
 */
const PERSONAL_NULL_KEYS: ReadonlySet<string> = new Set(["myVoteOptionId", "myVoteCandidateId"]);

export function redactPersonalFields(value: unknown): unknown {
  if (Array.isArray(value))
    return value.map(redactPersonalFields);
  if (value && typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>))
      out[k] = PERSONAL_NULL_KEYS.has(k) ? null : redactPersonalFields(v);
    return out;
  }
  return value;
}

export function serializePersistedClient(client: unknown): string {
  return JSON.stringify(redactPersonalFields(client));
}

// AsyncStorage persister — directory + announcements work offline from cache
export const asyncStoragePersister = createAsyncStoragePersister({
  storage: AsyncStorage,
  serialize: serializePersistedClient,
  throttleTime: 1000,
  key: "eastpark-query-cache",
});

// Changing the buster discards any previously persisted cache — including
// private data written by builds that persisted the whole cache.
export const QUERY_CACHE_BUSTER = `v${Env.EXPO_PUBLIC_VERSION}-public-2`;

export const queryPersistOptions = {
  persister: asyncStoragePersister,
  buster: QUERY_CACHE_BUSTER,
  dehydrateOptions: { shouldDehydrateQuery: shouldPersistQuery },
};

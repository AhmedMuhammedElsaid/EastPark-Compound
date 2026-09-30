import AsyncStorage from "@react-native-async-storage/async-storage";
import { createAsyncStoragePersister } from "@tanstack/query-async-storage-persister";
import { QueryCache, QueryClient } from "@tanstack/react-query";

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
      retry: 2,
      refetchOnWindowFocus: false,
    },
    mutations: {
      retry: 0,
    },
  },
});

// AsyncStorage persister — directory + announcements work offline from cache
export const asyncStoragePersister = createAsyncStoragePersister({
  storage: AsyncStorage,
  throttleTime: 1000,
  key: "eastpark-query-cache",
});

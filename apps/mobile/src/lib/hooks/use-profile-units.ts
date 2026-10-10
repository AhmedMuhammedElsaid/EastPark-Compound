import type { AuthUser } from "@/store/slices/auth-slice";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import * as React from "react";
import { usersApi } from "@/services/api/users";
import { useAppDispatch, useAppSelector } from "@/store";
import { updateUser } from "@/store/slices/auth-slice";

export const PROFILE_QUERY_ROOT = "profile-units";

export function profileQueryKey(userId: string | undefined) {
  return [PROFILE_QUERY_ROOT, userId] as const;
}

/**
 * `GET /user/profile` (the only response that carries `units`), shared by
 * Profile, My flats, Edit profile and checkout. Its flats and primary flat
 * are copied into the auth slice.
 */
export function useProfileQuery() {
  const dispatch = useAppDispatch();
  const userId = useAppSelector(s => s.auth.user?.id);
  const query = useQuery({
    queryKey: profileQueryKey(userId),
    queryFn: () => usersApi.getProfile(),
    enabled: Boolean(userId),
    staleTime: 30_000,
  });
  const profile = query.data?.data?.data;
  React.useEffect(() => {
    if (profile && profile.id === userId)
      dispatch(updateUser({ units: profile.units ?? [], unitNumber: profile.unitNumber }));
  }, [profile, userId, dispatch]);
  return { ...query, profile: profile && profile.id === userId ? profile : undefined };
}

/**
 * Refreshes the signed-in user's flats into the auth slice. Failures are
 * silent: the stored user, or the legacy `unitNumber`, keeps working.
 */
export function useRefreshProfileUnits(): void {
  useProfileQuery();
}

const SAVED_FIELDS = ["name", "phone", "avatarUrl", "unitNumber"] as const;

/** The editable fields present in a `PUT /user` response (absent ones stay as stored). */
export function pickSavedFields(saved: Partial<AuthUser>): Partial<AuthUser> {
  const picked: Partial<AuthUser> = {};
  for (const key of SAVED_FIELDS) {
    if (saved[key] !== undefined)
      (picked as Record<string, unknown>)[key] = saved[key];
  }
  return picked;
}

/**
 * After a successful `PUT /user`: store the saved fields (the response has no
 * `units`, so the stored flats are kept) and refetch the full profile.
 */
export function useApplySavedProfile() {
  const dispatch = useAppDispatch();
  const queryClient = useQueryClient();
  const userId = useAppSelector(s => s.auth.user?.id);
  return React.useCallback((saved: Partial<AuthUser> | undefined) => {
    if (saved)
      dispatch(updateUser(pickSavedFields(saved)));
    return queryClient.invalidateQueries({ queryKey: profileQueryKey(userId) });
  }, [dispatch, queryClient, userId]);
}

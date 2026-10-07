import { useQuery } from "@tanstack/react-query";
import * as React from "react";
import { usersApi } from "@/services/api/users";
import { useAppDispatch, useAppSelector } from "@/store";
import { updateUser } from "@/store/slices/auth-slice";

/**
 * Refreshes the signed-in user's flats from `GET /user/profile` (the only
 * response that carries `units`) into the auth slice. Failures are silent:
 * the stored user, or the legacy `unitNumber`, keeps working.
 */
export function useRefreshProfileUnits(): void {
  const dispatch = useAppDispatch();
  const userId = useAppSelector(s => s.auth.user?.id);
  const { data } = useQuery({
    queryKey: ["profile-units", userId],
    queryFn: () => usersApi.getProfile(),
    enabled: Boolean(userId),
    staleTime: 30_000,
  });
  const profile = data?.data?.data;
  React.useEffect(() => {
    if (profile && profile.id === userId)
      dispatch(updateUser({ units: profile.units ?? [], unitNumber: profile.unitNumber }));
  }, [profile, userId, dispatch]);
}

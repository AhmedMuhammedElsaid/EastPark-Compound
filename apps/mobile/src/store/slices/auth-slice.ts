import type { PayloadAction } from "@reduxjs/toolkit";

import { createSlice } from "@reduxjs/toolkit";

export type ResidentUnit = {
  id: string;
  building: string;
  floor: string;
  flatNumber: string;
  /** `${building}-${floor}-${flatNumber}` */
  label: string;
  createdAt: string;
};

export type AuthUser = {
  id: string;
  name: string;
  email: string;
  role: "RESIDENT" | "MERCHANT" | "ADMIN" | "SUPER_ADMIN";
  isVerified: boolean;
  avatarUrl: string | null;
  /** Primary flat label (legacy single-flat field; kept by the backend). */
  unitNumber?: string | null;
  /** Owned flats. Only `GET /user/profile` returns it; absent on older backends. */
  units?: ResidentUnit[];
  phone?: string;
};

/**
 * Replace the stored user with one from a response that may lack `units`
 * (login, PUT /user, accept-invitation): keep the previous flats, but only
 * when it is the same account.
 */
export function mergeUserKeepingUnits(prev: AuthUser | null | undefined, next: AuthUser): AuthUser {
  if (next.units !== undefined || !prev || prev.id !== next.id || prev.units === undefined)
    return next;
  return { ...next, units: prev.units };
}

type AuthWallConfig = {
  redirectAction?: string;
  message?: string;
};

type AuthState = {
  user: AuthUser | null;
  accessToken: string | null;
  refreshToken: string | null;
  isAuthenticated: boolean;
  // Auth-wall bottom sheet
  showAuthWall: boolean;
  authWallConfig: AuthWallConfig | null;
  // Route to return to after a successful login (auth-wall replay). Kept
  // separate from authWallConfig because hiding the sheet clears that.
  pendingRedirect: string | null;
};

const initialState: AuthState = {
  user: null,
  accessToken: null,
  refreshToken: null,
  isAuthenticated: false,
  showAuthWall: false,
  authWallConfig: null,
  pendingRedirect: null,
};

export const authSlice = createSlice({
  name: "auth",
  initialState,
  reducers: {
    login(
      state,
      action: PayloadAction<{
        user: AuthUser;
        accessToken: string;
        refreshToken: string;
      }>,
    ) {
      state.user = mergeUserKeepingUnits(state.user, action.payload.user);
      state.accessToken = action.payload.accessToken;
      state.refreshToken = action.payload.refreshToken;
      state.isAuthenticated = true;
      state.showAuthWall = false;
      state.authWallConfig = null;
    },
    logout(state) {
      state.user = null;
      state.accessToken = null;
      state.refreshToken = null;
      state.isAuthenticated = false;
      state.showAuthWall = false;
      state.authWallConfig = null;
      state.pendingRedirect = null;
    },
    updateTokens(
      state,
      action: PayloadAction<{ accessToken: string; refreshToken: string }>,
    ) {
      state.accessToken = action.payload.accessToken;
      state.refreshToken = action.payload.refreshToken;
    },
    updateUser(state, action: PayloadAction<Partial<AuthUser>>) {
      if (state.user) {
        state.user = { ...state.user, ...action.payload };
      }
    },
    showAuthWall(state, action: PayloadAction<AuthWallConfig | undefined>) {
      state.showAuthWall = true;
      state.authWallConfig = action.payload ?? null;
      if (action.payload?.redirectAction)
        state.pendingRedirect = action.payload.redirectAction;
    },
    hideAuthWall(state) {
      state.showAuthWall = false;
      state.authWallConfig = null;
    },
    setPendingRedirect(state, action: PayloadAction<string | null>) {
      state.pendingRedirect = action.payload;
    },
    clearPendingRedirect(state) {
      state.pendingRedirect = null;
    },
  },
});

export const {
  login,
  logout,
  updateTokens,
  updateUser,
  showAuthWall,
  hideAuthWall,
  setPendingRedirect,
  clearPendingRedirect,
} = authSlice.actions;

export default authSlice.reducer;

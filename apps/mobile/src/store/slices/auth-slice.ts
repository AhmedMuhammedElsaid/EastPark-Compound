import type { PayloadAction } from "@reduxjs/toolkit";

import { createSlice } from "@reduxjs/toolkit";

export type AuthUser = {
  id: string;
  name: string;
  email: string;
  role: "RESIDENT" | "MERCHANT" | "ADMIN";
  isVerified: boolean;
  avatarUrl: string | null;
  unitNumber?: string;
  phone?: string;
};

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
};

const initialState: AuthState = {
  user: null,
  accessToken: null,
  refreshToken: null,
  isAuthenticated: false,
  showAuthWall: false,
  authWallConfig: null,
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
      state.user = action.payload.user;
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
    },
    hideAuthWall(state) {
      state.showAuthWall = false;
      state.authWallConfig = null;
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
} = authSlice.actions;

export default authSlice.reducer;

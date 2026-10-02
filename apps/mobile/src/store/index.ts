import type { TypedUseSelectorHook } from "react-redux";

import AsyncStorage from "@react-native-async-storage/async-storage";
import { configureStore } from "@reduxjs/toolkit";
import { useDispatch, useSelector } from "react-redux";
import { FLUSH, PAUSE, PERSIST, persistReducer, persistStore, PURGE, REGISTER, REHYDRATE } from "redux-persist";

import authReducer from "./slices/auth-slice";
import cartReducer from "./slices/cart-slice";
import preferencesReducer from "./slices/preferences-slice";

const authPersistConfig = {
  key: "auth",
  storage: AsyncStorage,
  // Tokens kept in SecureStore; Redux holds in-memory copy only for interceptors.
  // We still persist user + isAuthenticated for UI state (tokens re-read from SecureStore on startup).
  blacklist: ["showAuthWall", "authWallConfig", "pendingRedirect", "accessToken", "refreshToken"],
};

const cartPersistConfig = {
  key: "cart",
  storage: AsyncStorage,
  // Don't persist conflict-sheet transient state
  blacklist: ["pendingItem", "pendingShopId", "pendingShopName", "showConflictSheet"],
};

const preferencesPersistConfig = {
  key: "preferences",
  storage: AsyncStorage,
};

export const store = configureStore({
  reducer: {
    auth: persistReducer(authPersistConfig, authReducer),
    cart: persistReducer(cartPersistConfig, cartReducer),
    preferences: persistReducer(preferencesPersistConfig, preferencesReducer),
  },
  middleware: getDefaultMiddleware =>
    getDefaultMiddleware({
      serializableCheck: {
        ignoredActions: [FLUSH, REHYDRATE, PAUSE, PERSIST, PURGE, REGISTER],
      },
    }),
});

export const persistor = persistStore(store);

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;

export const useAppDispatch: () => AppDispatch = useDispatch;
export const useAppSelector: TypedUseSelectorHook<RootState> = useSelector;

import type { PayloadAction } from "@reduxjs/toolkit";

import { createSlice } from "@reduxjs/toolkit";

type Language = "ar" | "en";
type Theme = "dark" | "light" | "system";

type PreferencesState = {
  language: Language;
  theme: Theme;
};

const initialState: PreferencesState = {
  language: "ar", // Arabic RTL is primary
  theme: "dark", // Dark mode is flagship default
};

export const preferencesSlice = createSlice({
  name: "preferences",
  initialState,
  reducers: {
    setLanguage(state, action: PayloadAction<Language>) {
      state.language = action.payload;
    },
    setTheme(state, action: PayloadAction<Theme>) {
      state.theme = action.payload;
    },
  },
});

export const { setLanguage, setTheme } = preferencesSlice.actions;

export default preferencesSlice.reducer;

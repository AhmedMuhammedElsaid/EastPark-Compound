/* eslint-disable ts/ban-ts-comment */
/* eslint-disable no-restricted-globals */

// Mock AsyncStorage (required by redux-persist and TanStack Query persister)
jest.mock("@react-native-async-storage/async-storage", () =>
  require("@react-native-async-storage/async-storage/jest/async-storage-mock"));

// Mock the Redux store — UI component tests transitively import @/store via i18n/utils.tsx.
// @reduxjs/toolkit and react-redux ship ESM-only builds that Jest (CJS) cannot parse,
// so we mock the store module entirely rather than trying to transform those packages.
jest.mock("@/store", () => {
  const state = {
    preferences: { language: "en", theme: "dark" },
    auth: { user: null, accessToken: null, refreshToken: null, isVerified: false, showAuthWall: false, authWallConfig: null },
    cart: { items: [], shopId: null },
  };
  return {
    store: {
      dispatch: jest.fn(),
      getState: jest.fn(() => state),
      subscribe: jest.fn(() => jest.fn()),
    },
    persistor: {
      flush: jest.fn().mockResolvedValue(undefined),
      pause: jest.fn(),
      persist: jest.fn(),
    },
    useAppDispatch: () => jest.fn(),
    useAppSelector: (selector: (s: typeof state) => any) => selector(state),
  };
});

jest.mock("@/store/slices/preferences-slice", () => ({
  setLanguage: jest.fn((lang: string) => ({ type: "preferences/setLanguage", payload: lang })),
  default: (state = { language: "en", theme: "dark" }, _action: any) => state,
}));

// Mock react-native-restart (native module — not available in Jest environment)
jest.mock("react-native-restart", () => ({ restart: jest.fn() }));

// Mock react-native-worklets first
jest.mock("react-native-worklets", () => ({
  __esModule: true,
  default: {},
}));

// Mock react-native-reanimated
jest.mock("react-native-reanimated", () => {
  const View = require("react-native").View;

  return {
    __esModule: true,
    default: {
      View,
      ScrollView: View,
      createAnimatedComponent: (component: any) => component,
    },
    useSharedValue: jest.fn(() => ({ value: 0 })),
    useAnimatedStyle: jest.fn(fn => fn()),
    withTiming: jest.fn(value => value),
    withSpring: jest.fn(value => value),
    withDecay: jest.fn(value => value),
    withDelay: jest.fn((_, value) => value),
    withRepeat: jest.fn(value => value),
    withSequence: jest.fn((...values) => values[0]),
    cancelAnimation: jest.fn(),
    Easing: {
      linear: jest.fn(),
      ease: jest.fn(),
      quad: jest.fn(),
      cubic: jest.fn(),
      bezier: jest.fn(),
      in: jest.fn(fn => fn),
      out: jest.fn(fn => fn),
      inOut: jest.fn(fn => fn),
    },
    FadeIn: { duration: jest.fn(() => ({})) },
    FadeOut: { duration: jest.fn(() => ({})) },
    FadeInDown: { duration: jest.fn(() => ({})) },
    FadeInUp: { duration: jest.fn(() => ({})) },
    FadeInLeft: { duration: jest.fn(() => ({})) },
    FadeInRight: { duration: jest.fn(() => ({})) },
    SlideInDown: { duration: jest.fn(() => ({})) },
    SlideInUp: { duration: jest.fn(() => ({})) },
    SlideInLeft: { duration: jest.fn(() => ({})) },
    SlideInRight: { duration: jest.fn(() => ({})) },
    Layout: {},
    Keyframe: jest.fn(),
  };
});

// Mock expo-localization
jest.mock("expo-localization", () => ({
  getLocales: jest.fn(() => [
    {
      languageTag: "en-US",
      languageCode: "en",
      textDirection: "ltr",
      digitGroupingSeparator: ",",
      decimalSeparator: ".",
      measurementSystem: "metric",
      currencyCode: "USD",
      currencySymbol: "$",
      regionCode: "US",
    },
  ]),
}));

// Global window object setup for React Native testing
// @ts-expect-error
global.window = {};

// @ts-expect-error
global.window = global;

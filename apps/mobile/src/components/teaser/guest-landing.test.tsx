import { fireEvent, render, screen } from "@testing-library/react-native";
import * as React from "react";

import { GuestLanding } from "./guest-landing";

const mockPush = jest.fn();

jest.mock("expo-router", () => ({ router: { push: (...a: unknown[]) => mockPush(...a), navigate: jest.fn() } }));
jest.mock("@react-navigation/native", () => ({ useIsFocused: jest.fn(() => true) }));
jest.mock("expo-haptics", () => ({ impactAsync: jest.fn(), ImpactFeedbackStyle: { Light: "light" } }));
jest.mock("react-native-flash-message", () => ({ showMessage: jest.fn() }));
jest.mock("react-i18next", () => ({ useTranslation: jest.fn(() => ({ t: (k: string) => k, i18n: { language: "en" } })) }));
jest.mock("react-native-safe-area-context", () => ({ useSafeAreaInsets: jest.fn(() => ({ top: 0, bottom: 0, left: 0, right: 0 })) }));
jest.mock("@/lib/hooks/use-app-colors", () => ({ useAppColors: jest.fn(() => require("@/theme/tokens").DARK) }));
jest.mock("@/components/ui/app-header", () => ({ AppHeader: () => null }));
jest.mock("./hero-backdrop", () => ({ HeroBackdrop: () => null }));

describe("guest landing", () => {
  beforeEach(() => mockPush.mockReset());
  afterEach(() => jest.restoreAllMocks());

  it("renders the web landing sections in order", () => {
    render(<GuestLanding />);
    const tree = JSON.stringify(screen.toJSON());
    const positions = [
      "landing.eyebrow",
      "home.teaser.ticker_label",
      "landing.how_title",
      "home.teaser.market_title",
      "home.teaser.vault_title",
      "landing.closing_title",
    ].map(key => tree.indexOf(`"${key}"`));
    expect(positions.every(position => position >= 0)).toBe(true);
    expect([...positions].sort((a, b) => a - b)).toEqual(positions);
  });

  it("opens the in-app unit-registration screen from both Register your unit buttons", () => {
    render(<GuestLanding />);

    fireEvent.press(screen.getByLabelText("landing.hero_cta"));
    fireEvent.press(screen.getByLabelText("landing.closing_cta"));

    expect(mockPush).toHaveBeenCalledTimes(2);
    expect(mockPush).toHaveBeenNthCalledWith(1, "/(auth)/register-unit");
    expect(mockPush).toHaveBeenNthCalledWith(2, "/(auth)/register-unit");
  });

  it("sends Sign in to the login screen", () => {
    render(<GuestLanding />);
    fireEvent.press(screen.getAllByLabelText("landing.sign_in_cta")[0]);
    expect(mockPush).toHaveBeenCalledWith("/(auth)/login");
  });

  it("renders step and option numbers with Arabic-Indic digits in Arabic", () => {
    jest.requireMock("react-i18next").useTranslation.mockReturnValue({ t: (k: string) => k, i18n: { language: "ar" } });
    render(<GuestLanding />);
    expect(screen.getAllByText("١").length).toBeGreaterThan(0);
    expect(screen.getByText("home.teaser.gov_option ٣", { includeHiddenElements: true })).toBeTruthy();
  });
});

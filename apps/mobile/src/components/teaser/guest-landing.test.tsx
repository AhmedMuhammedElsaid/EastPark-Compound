import { fireEvent, render, screen } from "@testing-library/react-native";
import * as React from "react";
import { Linking } from "react-native";

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

  it("opens the web unit-registration form from both Register your unit buttons", () => {
    const openURL = jest.spyOn(Linking, "openURL").mockResolvedValue(true);
    render(<GuestLanding />);

    fireEvent.press(screen.getByLabelText("landing.hero_cta"));
    fireEvent.press(screen.getByLabelText("landing.closing_cta"));

    expect(openURL).toHaveBeenCalledTimes(2);
    expect(openURL).toHaveBeenNthCalledWith(1, "https://eastpark-web-app.vercel.app/register-unit");
    expect(openURL).toHaveBeenNthCalledWith(2, "https://eastpark-web-app.vercel.app/register-unit");
  });

  it("sends Sign in to the login screen", () => {
    render(<GuestLanding />);
    fireEvent.press(screen.getAllByLabelText("landing.sign_in_cta")[0]);
    expect(mockPush).toHaveBeenCalledWith("/(auth)/login");
  });
});

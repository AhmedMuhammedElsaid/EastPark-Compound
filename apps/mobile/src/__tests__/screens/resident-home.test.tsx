import { render, screen } from "@testing-library/react-native";
import * as React from "react";

let mockRole = "RESIDENT";

jest.mock("@/store", () => ({
  useAppSelector: jest.fn((selector: (s: { auth: { user: { role: string; name: string } } }) => unknown) =>
    selector({ auth: { user: { role: mockRole, name: "Sara Ali" } } })),
}));
jest.mock("@tanstack/react-query", () => ({
  useQuery: jest.fn(() => ({ data: undefined, isLoading: false, refetch: jest.fn() })),
}));
jest.mock("expo-router", () => ({ router: { push: jest.fn() } }));
jest.mock("expo-image", () => ({ Image: () => null }));
jest.mock("react-i18next", () => ({
  useTranslation: jest.fn(() => ({ t: (k: string) => k, i18n: { language: "en" } })),
}));
jest.mock("react-native-safe-area-context", () => ({ useSafeAreaInsets: jest.fn(() => ({ top: 0, bottom: 0, left: 0, right: 0 })) }));
jest.mock("@/components/ui/app-header", () => ({ AppHeader: () => null }));
jest.mock("@/lib/hooks/use-app-colors", () => {
  const { DARK } = require("@/theme/tokens");
  return { useAppColors: () => DARK };
});
jest.mock("@/lib/hooks/use-auth-guard", () => ({ useAuthGuard: () => ({ requireAuthNavigation: jest.fn() }) }));
jest.mock("@/services/api/community", () => ({ communityApi: { getAnnouncements: jest.fn() } }));
jest.mock("@/services/api/shops", () => ({ shopsApi: { getShops: jest.fn() } }));

const { ResidentHome } = require("@/components/home/resident-home");

const COMMUNITY_TILES = ["home.community", "governance.title", "home.my_orders", "community.reports"];

describe("resident home for the accountant role", () => {
  it("hides the community, governance, orders and reports tiles and the What's new section", () => {
    mockRole = "ACCOUNTANT";
    render(<ResidentHome />);

    for (const label of COMMUNITY_TILES)
      expect(screen.queryByLabelText(label)).toBeNull();
    expect(screen.queryByText("home.whats_new")).toBeNull();
    // The shops "See all" stays, the What's new one is gone.
    expect(screen.getAllByLabelText("common.see_all")).toHaveLength(1);
    // Feedback and shops stay open to the accountant.
    expect(screen.getByLabelText("feedback.title")).toBeTruthy();
    expect(screen.getByLabelText("home.shops")).toBeTruthy();
  });

  it.each(["RESIDENT", "ADMIN", "SUPER_ADMIN"])("keeps every tile and What's new for %s", (role) => {
    mockRole = role;
    render(<ResidentHome />);

    for (const label of COMMUNITY_TILES)
      expect(screen.getByLabelText(label)).toBeTruthy();
    expect(screen.getByText("home.whats_new")).toBeTruthy();
    expect(screen.getAllByLabelText("common.see_all")).toHaveLength(2);
  });
});

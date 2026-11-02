import { render, screen } from "@testing-library/react-native";
import * as React from "react";

let mockIsAuthenticated = true;
let mockRole: string | undefined = "RESIDENT";
let mockSegments: string[] = [];

jest.mock("@/store", () => ({
  useAppSelector: jest.fn((selector: (s: unknown) => unknown) =>
    selector({ auth: { isAuthenticated: mockIsAuthenticated, user: mockRole ? { role: mockRole } : undefined } })),
}));
jest.mock("@/lib/hooks/use-app-colors", () => {
  const { DARK } = require("@/theme/tokens");
  return { useAppColors: () => DARK };
});
jest.mock("expo-router", () => {
  const { Text } = require("react-native");
  return {
    Redirect: ({ href }: { href: string }) => require("react").createElement(Text, null, `redirect:${href}`),
    Stack: () => require("react").createElement(Text, null, "community-stack"),
    useSegments: () => mockSegments,
  };
});

const CommunityLayout = require("@/app/(tabs)/community/_layout").default;

describe("community stack guard", () => {
  it("sends a guest to Home", () => {
    mockIsAuthenticated = false;
    mockRole = undefined;
    mockSegments = ["(tabs)", "community"];
    render(<CommunityLayout />);
    expect(screen.getByText("redirect:/(tabs)")).toBeTruthy();
  });

  it.each([
    ["community"],
    ["governance"],
    ["reports"],
    ["[announcementId]"],
  ])("sends an accountant away from %s", (screen_) => {
    mockIsAuthenticated = true;
    mockRole = "ACCOUNTANT";
    mockSegments = ["(tabs)", "community", screen_];
    render(<CommunityLayout />);
    expect(screen.getByText("redirect:/(tabs)")).toBeTruthy();
  });

  it("lets an accountant use feedback", () => {
    mockIsAuthenticated = true;
    mockRole = "ACCOUNTANT";
    mockSegments = ["(tabs)", "community", "feedback", "new"];
    render(<CommunityLayout />);
    expect(screen.getByText("community-stack")).toBeTruthy();
  });

  it("does not redirect an accountant while another tab is active (the stack stays mounted)", () => {
    mockIsAuthenticated = true;
    mockRole = "ACCOUNTANT";
    mockSegments = ["(tabs)", "profile"];
    render(<CommunityLayout />);
    expect(screen.getByText("community-stack")).toBeTruthy();
  });

  it.each(["RESIDENT", "MERCHANT", "ADMIN", "SUPER_ADMIN"])("keeps the whole stack open for %s", (role) => {
    mockIsAuthenticated = true;
    mockRole = role;
    mockSegments = ["(tabs)", "community", "governance"];
    render(<CommunityLayout />);
    expect(screen.getByText("community-stack")).toBeTruthy();
  });
});

import { render, screen } from "@testing-library/react-native";
import * as React from "react";

let mockIsAuthenticated = false;

jest.mock("@/store", () => ({
  useAppSelector: jest.fn((selector: (s: { auth: { isAuthenticated: boolean } }) => unknown) =>
    selector({ auth: { isAuthenticated: mockIsAuthenticated } })),
}));
jest.mock("@/components/home/resident-home", () => {
  const { Text } = require("react-native");
  return { ResidentHome: () => require("react").createElement(Text, null, "resident-home") };
});
jest.mock("@/components/teaser/guest-landing", () => {
  const { Text } = require("react-native");
  return { GuestLanding: () => require("react").createElement(Text, null, "guest-landing") };
});

const HomeScreen = require("@/app/(tabs)/index").default;

describe("home tab", () => {
  it("shows the public landing page to a guest", () => {
    mockIsAuthenticated = false;
    render(<HomeScreen />);
    expect(screen.getByText("guest-landing")).toBeTruthy();
    expect(screen.queryByText("resident-home")).toBeNull();
  });

  it("keeps the resident home for a signed-in user", () => {
    mockIsAuthenticated = true;
    render(<HomeScreen />);
    expect(screen.getByText("resident-home")).toBeTruthy();
    expect(screen.queryByText("guest-landing")).toBeNull();
  });
});

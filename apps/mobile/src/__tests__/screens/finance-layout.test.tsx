import { render, screen } from "@testing-library/react-native";
import * as React from "react";

let mockIsAuthenticated = false;
let mockRole: string | undefined;

jest.mock("react-redux", () => ({
  useSelector: jest.fn((selector: (s: unknown) => unknown) =>
    selector({ auth: { isAuthenticated: mockIsAuthenticated, user: mockRole ? { role: mockRole } : undefined } })),
}));
jest.mock("expo-router", () => {
  const { Text } = require("react-native");
  return {
    Redirect: ({ href }: { href: string }) => require("react").createElement(Text, null, `redirect:${href}`),
    Stack: () => require("react").createElement(Text, null, "finance-stack"),
  };
});

const FinanceLayout = require("@/app/(finance)/_layout").default;

describe("finance layout guard", () => {
  it("sends a signed-out visitor to login", () => {
    mockIsAuthenticated = false;
    mockRole = undefined;
    render(<FinanceLayout />);
    expect(screen.getByText("redirect:/(auth)/login")).toBeTruthy();
  });

  it.each(["RESIDENT", "MERCHANT"])("sends %s back to the tabs", (role) => {
    mockIsAuthenticated = true;
    mockRole = role;
    render(<FinanceLayout />);
    expect(screen.getByText("redirect:/(tabs)")).toBeTruthy();
  });

  it.each(["ACCOUNTANT", "ADMIN", "SUPER_ADMIN"])("opens the finance stack for %s", (role) => {
    mockIsAuthenticated = true;
    mockRole = role;
    render(<FinanceLayout />);
    expect(screen.getByText("finance-stack")).toBeTruthy();
  });
});

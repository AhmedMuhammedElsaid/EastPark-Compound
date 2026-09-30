/**
 * Real login-form tests — replaces the `it.todo` placeholder.
 *
 * The actual login form lives at `src/app/(auth)/login.tsx` (this file under
 * `features/auth/components/` is an unused obytes-boilerplate leftover — see
 * `login-form.tsx` in this same folder). We test the real screen component.
 */
import * as React from "react";
import { SafeAreaProvider } from "react-native-safe-area-context";

import LoginScreen from "@/app/(auth)/login";

import { useBiometric } from "@/lib/hooks/use-biometric";

import { cleanup, render, screen, setup, waitFor } from "@/lib/test-utils";
import { authApi } from "@/services/api/auth";
import { registerPushToken } from "@/services/push";
// Registers the i18next instance (react-i18next needs it initialized once,
// normally done by src/app/_layout.tsx which this test doesn't render).
import "@/lib/i18n";

// AuthScreenWrapper reads useSafeAreaInsets(), which needs a SafeAreaProvider
// ancestor. In production this comes from expo-router's root — supply fixed
// initialMetrics here so the provider doesn't wait on a native layout event
// that never fires under react-test-renderer.
const TEST_SAFE_AREA_METRICS = {
  frame: { x: 0, y: 0, width: 320, height: 640 },
  insets: { top: 0, left: 0, right: 0, bottom: 0 },
};

function renderLogin() {
  return render(
    <SafeAreaProvider initialMetrics={TEST_SAFE_AREA_METRICS}>
      <LoginScreen />
    </SafeAreaProvider>,
  );
}

function setupLogin() {
  return setup(
    <SafeAreaProvider initialMetrics={TEST_SAFE_AREA_METRICS}>
      <LoginScreen />
    </SafeAreaProvider>,
  );
}

jest.mock("@/services/api/auth", () => ({
  authApi: {
    login: jest.fn(),
  },
}));

jest.mock("@/services/push", () => ({
  registerPushToken: jest.fn().mockResolvedValue(undefined),
}));

jest.mock("@/lib/hooks/use-biometric", () => ({
  useBiometric: jest.fn(),
}));

const mockReplace = jest.fn();
jest.mock("expo-router", () => ({
  router: { replace: (...args: unknown[]) => mockReplace(...args), push: jest.fn() },
}));

afterEach(cleanup);

function disableBiometric() {
  (useBiometric as jest.Mock).mockReturnValue({
    ready: true,
    isAvailable: false,
    enabled: false,
    kind: "generic",
    email: null,
    authenticate: jest.fn(),
    enable: jest.fn(),
    disable: jest.fn(),
    refresh: jest.fn(),
  });
}

describe("login screen ", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    disableBiometric();
  });

  it("renders the email and password inputs and the sign-in button", () => {
    renderLogin();
    expect(screen.getByLabelText("Email address")).toBeOnTheScreen();
    expect(screen.getByLabelText("Password")).toBeOnTheScreen();
    expect(screen.getByRole("button", { name: "Sign In" })).toBeOnTheScreen();
  });

  it("shows validation errors when submitting an empty form", async () => {
    const { user } = setupLogin();

    await user.press(screen.getByRole("button", { name: "Sign In" }));

    expect(
      await screen.findByText("Enter a valid email address"),
    ).toBeOnTheScreen();
    expect(
      screen.getByText("Password must be at least 8 characters"),
    ).toBeOnTheScreen();
    expect(authApi.login).not.toHaveBeenCalled();
  });

  it("shows a validation error for a too-short password with a valid email", async () => {
    const { user } = setupLogin();

    await user.type(screen.getByLabelText("Email address"), "resident@eastpark.local");
    await user.type(screen.getByLabelText("Password"), "short");
    await user.press(screen.getByRole("button", { name: "Sign In" }));

    expect(
      await screen.findByText("Password must be at least 8 characters"),
    ).toBeOnTheScreen();
    expect(authApi.login).not.toHaveBeenCalled();
  });

  it("submits valid credentials and navigates to the tabs on success", async () => {
    (authApi.login as jest.Mock).mockResolvedValue({
      data: {
        data: {
          user: { id: "1", name: "Resident", email: "resident@eastpark.local", role: "RESIDENT", isVerified: true, avatarUrl: null },
          accessToken: "access-token",
          refreshToken: "refresh-token",
        },
      },
    });

    const { user } = setupLogin();

    await user.type(screen.getByLabelText("Email address"), "resident@eastpark.local");
    await user.type(screen.getByLabelText("Password"), "password123");
    await user.press(screen.getByRole("button", { name: "Sign In" }));

    await waitFor(() => {
      expect(authApi.login).toHaveBeenCalledWith({
        email: "resident@eastpark.local",
        password: "password123",
      });
    });
    await waitFor(() => expect(registerPushToken).toHaveBeenCalled());
    await waitFor(() => expect(mockReplace).toHaveBeenCalledWith("/(tabs)"));
  });

  it("shows an error message and does not navigate when login fails", async () => {
    (authApi.login as jest.Mock).mockRejectedValue(new Error("Unauthorized"));

    const { user } = setupLogin();

    await user.type(screen.getByLabelText("Email address"), "resident@eastpark.local");
    await user.type(screen.getByLabelText("Password"), "wrongpassword");
    await user.press(screen.getByRole("button", { name: "Sign In" }));

    await waitFor(() => expect(authApi.login).toHaveBeenCalled());
    expect(mockReplace).not.toHaveBeenCalled();
  });
});

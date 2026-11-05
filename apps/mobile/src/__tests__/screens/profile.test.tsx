import { render, screen } from "@testing-library/react-native";
import * as React from "react";

let mockRole = "RESIDENT";

jest.mock("@/store", () => ({
  useAppSelector: jest.fn((selector: (s: unknown) => unknown) =>
    selector({
      auth: {
        isAuthenticated: true,
        user: { id: "u1", name: "Sara Ali", email: "sara@example.com", role: mockRole, units: [] },
      },
    })),
}));
jest.mock("@tanstack/react-query", () => ({ useMutation: jest.fn(() => ({ mutate: jest.fn() })) }));
jest.mock("expo-router", () => ({ router: { push: jest.fn() } }));
jest.mock("expo-haptics", () => ({ impactAsync: jest.fn(), ImpactFeedbackStyle: { Light: "light" } }));
jest.mock("expo-image", () => ({ Image: () => null }));
jest.mock("react-native-flash-message", () => ({ showMessage: jest.fn() }));
jest.mock("react-i18next", () => ({ useTranslation: jest.fn(() => ({ t: (k: string) => k })) }));
jest.mock("react-native-safe-area-context", () => ({ useSafeAreaInsets: jest.fn(() => ({ top: 0, bottom: 0, left: 0, right: 0 })) }));
jest.mock("@/components/ui/app-header", () => ({ AppHeader: () => null }));
jest.mock("@/lib/hooks/use-app-colors", () => {
  const { DARK } = require("@/theme/tokens");
  return { useAppColors: () => DARK };
});
jest.mock("@/lib/hooks/use-biometric", () => ({ useBiometric: () => ({ ready: false, isAvailable: false }) }));
jest.mock("@/lib/hooks/use-profile-units", () => ({ useRefreshProfileUnits: jest.fn() }));
jest.mock("@/lib/hooks/use-selected-theme", () => ({
  useSelectedTheme: () => ({ selectedTheme: "dark", setSelectedTheme: jest.fn() }),
}));
jest.mock("@/lib/i18n", () => ({ useSelectedLanguage: () => ({ language: "en", setLanguage: jest.fn() }) }));
jest.mock("@/lib/confirm-dialog", () => ({ showConfirm: jest.fn() }));
jest.mock("@/lib/web-links", () => ({ openPrivacyPolicy: jest.fn() }));
jest.mock("@/services/api/users", () => ({ usersApi: { deleteAccount: jest.fn() } }));
jest.mock("@/services/auth/session", () => ({ endDeletedAccountSession: jest.fn(), signOut: jest.fn() }));

const ProfileScreen = require("@/app/(tabs)/profile/index").default;

describe("profile: My orders row", () => {
  it("is hidden for the accountant role", () => {
    mockRole = "ACCOUNTANT";
    render(<ProfileScreen />);
    expect(screen.queryByText("profile.my_orders")).toBeNull();
    expect(screen.getByText("profile.my_feedback")).toBeTruthy();
  });

  it.each(["RESIDENT", "MERCHANT", "ADMIN", "SUPER_ADMIN"])("is shown for %s", (role) => {
    mockRole = role;
    render(<ProfileScreen />);
    expect(screen.getByText("profile.my_orders")).toBeTruthy();
  });
});

describe("profile: Delete account row", () => {
  it.each(["RESIDENT", "MERCHANT"])("is shown for %s", (role) => {
    mockRole = role;
    render(<ProfileScreen />);
    expect(screen.getByLabelText("profile.delete_account")).toBeTruthy();
  });

  it.each(["ACCOUNTANT", "ADMIN", "SUPER_ADMIN"])("is hidden for %s", (role) => {
    mockRole = role;
    render(<ProfileScreen />);
    expect(screen.queryByLabelText("profile.delete_account")).toBeNull();
    expect(screen.getByLabelText("auth.logout")).toBeTruthy();
  });
});
